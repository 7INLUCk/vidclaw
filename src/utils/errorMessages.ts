/**
 * errorMessages.ts — Pattern-based error enrichment for Seedance & Kling tasks
 *
 * Neither platform exposes a structured error-code enum via the CLI / Coze SSE.
 * We match against the raw error string to bucket it into one of four categories,
 * then emit a user-friendly title + actionable hint.
 */

export type ErrorCategory = 'material' | 'content' | 'account' | 'system' | 'unknown';
export type ErrorAction   = 'retry' | 'fix-material' | 'fix-prompt' | 'relogin';

export interface ParsedError {
  category: ErrorCategory;
  /** One-line label shown as a badge (e.g. "素材不符合要求") */
  title: string;
  /** Full sentence explaining what happened + how to fix it */
  message: string;
  /** Short label for the primary action button */
  actionLabel: string;
  action: ErrorAction;
  /** Whether "重试" makes sense without any user change */
  retryable: boolean;
}

// ── Pattern registry ──────────────────────────────────────────────────────────

interface PatternRule {
  patterns: RegExp[];
  result: Omit<ParsedError, 'action' | 'actionLabel' | 'retryable'> & {
    action: ErrorAction;
  };
}

/**
 * Rules are tested top-to-bottom; first match wins.
 * Patterns use case-insensitive regex on the lowercased raw error string.
 */
const RULES: PatternRule[] = [
  // ── Material: resolution ────────────────────────────────────────────────
  {
    patterns: [/分辨率/, /resolution/, /像素/, /pixel/, /尺寸不符/, /宽高比/],
    result: {
      category: 'material',
      title: '素材分辨率不符',
      message: '素材的分辨率或宽高比不满足要求。建议使用分辨率 ≥ 720p、宽高比为 16:9 / 9:16 / 1:1 的图片或视频。',
      action: 'fix-material',
    },
  },
  // ── Material: duration ──────────────────────────────────────────────────
  {
    patterns: [/时长/, /duration/, /视频太长/, /视频过长/, /视频过短/, /超出时长/, /不超过/, /视频时间/],
    result: {
      category: 'material',
      title: '参考视频时长超限',
      message: '参考视频总时长超出平台限制（即梦要求所有参考视频合计 ≤ 15.4 秒）。请裁剪视频或减少上传数量。',
      action: 'fix-material',
    },
  },
  // ── Material: format ────────────────────────────────────────────────────
  {
    patterns: [/格式不支持/, /format/, /unsupported/, /文件格式/, /不支持该/, /invalid.*file/],
    result: {
      category: 'material',
      title: '素材格式不支持',
      message: '素材文件格式不被支持。请使用 JPG / PNG / WebP 图片，或 MP4 / MOV 视频。',
      action: 'fix-material',
    },
  },
  // ── Material: file size ─────────────────────────────────────────────────
  {
    patterns: [/文件过大/, /大小超出/, /size.*limit/, /too large/, /超过.*限制/, /超出.*大小/, /文件大小/],
    result: {
      category: 'material',
      title: '素材文件过大',
      message: '素材文件超出上传限制。图片请控制在 30 MB 以内，视频控制在 50 MB 以内，音频控制在 10 MB 以内。',
      action: 'fix-material',
    },
  },
  // ── Material: quality ───────────────────────────────────────────────────
  {
    patterns: [/画质/, /图像质量/, /质量不符/, /清晰度不足/, /模糊/, /low quality/],
    result: {
      category: 'material',
      title: '素材画质不足',
      message: '素材画质过低，无法识别有效内容。请换用更清晰的图片或视频（建议 ≥ 720p）。',
      action: 'fix-material',
    },
  },

  // ── Content: face / celebrity ───────────────────────────────────────────
  {
    patterns: [/人脸/, /人像/, /face detect/, /face.*check/, /明星/, /名人/, /公众人物/, /换脸/, /肖像/],
    result: {
      category: 'content',
      title: '人脸检测未通过',
      message: '素材或提示词触发了人脸识别审核。请避免使用真实人物面部（尤其是公众人物/明星）的照片或视频，并在提示词中删除涉及真实人名的描述。',
      action: 'fix-prompt',
    },
  },
  // ── Content: copyright ──────────────────────────────────────────────────
  {
    patterns: [/版权/, /copyright/, /侵权/, /ip/, /知识产权/, /商标/, /品牌/],
    result: {
      category: 'content',
      title: '版权检测未通过',
      message: '内容涉及受保护的版权素材（角色、品牌、商标等）。请替换为无版权限制的素材，并修改提示词中的具体品牌/角色名称。',
      action: 'fix-prompt',
    },
  },
  // ── Content: safety / NSFW ──────────────────────────────────────────────
  {
    patterns: [
      /违规/, /不合规/, /审核未通过/, /安全检测/, /内容安全/, /内容不符合/,
      /政治/, /敏感/, /违禁/, /涉黄/, /暴力/, /色情/, /terrorism/, /nsfw/,
      /content.*policy/, /safety/, /prohibited/, /违反规定/,
    ],
    result: {
      category: 'content',
      title: '内容安全审核未通过',
      message: '提示词或素材触发了平台安全策略。请修改提示词，避免涉及政治敏感、暴力、色情或其他违禁内容，并检查素材是否包含不符合规定的画面。',
      action: 'fix-prompt',
    },
  },
  // ── Content: minor protection ───────────────────────────────────────────
  {
    patterns: [/未成年/, /儿童/, /minor/, /child/],
    result: {
      category: 'content',
      title: '未成年人保护限制',
      message: '内容涉及未成年人相关限制。请调整素材与提示词，避免涉及未成年人形象的相关描述。',
      action: 'fix-prompt',
    },
  },

  // ── Account: insufficient credits ──────────────────────────────────────
  {
    patterns: [/积分不足/, /余额不足/, /credits.*insufficient/, /insufficient.*credit/, /无法生成/, /quota.*exceed/],
    result: {
      category: 'account',
      title: '账号积分不足',
      message: '账号积分余额不足，无法继续生成任务。请前往「积分」页面充值后重试。',
      action: 'relogin',
    },
  },
  // ── Account: login / token expired ─────────────────────────────────────
  {
    patterns: [/未登录/, /token.*失效/, /token.*过期/, /login.*required/, /认证失败/, /expired/, /unauthorized/, /401/],
    result: {
      category: 'account',
      title: '登录已失效',
      message: '账号登录状态已过期。请前往「设置」页面重新登录后重试。',
      action: 'relogin',
    },
  },
  // ── Account: rate limit ─────────────────────────────────────────────────
  {
    patterns: [/请求.*频繁/, /rate.*limit/, /too many requests/, /限流/, /频率/, /服务繁忙/, /稍后重试/, /busy/],
    result: {
      category: 'account',
      title: '请求过于频繁',
      message: '当前请求频率超出平台限制，服务暂时繁忙。请等待 1–2 分钟后重试。',
      action: 'retry',
    },
  },

  // ── System: timeout ─────────────────────────────────────────────────────
  {
    patterns: [/超时/, /timeout/, /timed.*out/, /请求超时/, /生成超时/],
    result: {
      category: 'system',
      title: '生成超时',
      message: '任务生成时间超出限制，可能是服务负载较高。请稍后重试。',
      action: 'retry',
    },
  },
  // ── System: server error ────────────────────────────────────────────────
  {
    patterns: [/内部错误/, /server.*error/, /系统异常/, /服务异常/, /500/, /internal/, /unexpected.*error/],
    result: {
      category: 'system',
      title: '服务暂时不可用',
      message: '服务器出现内部错误，通常为临时故障。请稍后重试，如持续失败请检查平台状态。',
      action: 'retry',
    },
  },
  // ── System: network / connection ────────────────────────────────────────
  {
    patterns: [/网络/, /连接/, /network/, /connection/, /econnreset/, /enotfound/, /econnrefused/],
    result: {
      category: 'system',
      title: '网络连接失败',
      message: '与服务器的连接中断，请检查网络后重试。',
      action: 'retry',
    },
  },
];

// ── Label & retryable maps ────────────────────────────────────────────────────

const ACTION_LABELS: Record<ErrorAction, string> = {
  retry:         '重试',
  'fix-material': '修改素材',
  'fix-prompt':  '修改后重试',
  relogin:       '前往设置',
};

const RETRYABLE: Record<ErrorAction, boolean> = {
  retry:         true,
  'fix-material': false,
  'fix-prompt':  false,
  relogin:       false,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a raw error string into a structured, user-facing error object.
 * Falls back to a generic "unknown" category when no pattern matches.
 */
export function parseTaskError(
  rawError: string | undefined | null,
  _source: 'seedance' | 'kling' = 'seedance',
): ParsedError {
  const raw = (rawError ?? '').trim();
  const lower = raw.toLowerCase();

  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(lower))) {
      const { action } = rule.result;
      return {
        ...rule.result,
        actionLabel: ACTION_LABELS[action],
        retryable: RETRYABLE[action],
      };
    }
  }

  // Generic fallback — show truncated raw error
  const display = raw.length > 80 ? raw.slice(0, 80) + '…' : raw || '生成失败';
  return {
    category: 'unknown',
    title: '生成失败',
    message: display || '任务生成失败，原因未知。可以尝试重新提交。',
    actionLabel: '重试',
    action: 'retry',
    retryable: true,
  };
}

/** Category badge colors (Tailwind classes) */
export const CATEGORY_COLORS: Record<ErrorCategory, { bg: string; text: string; border: string }> = {
  material: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  content:  { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20'    },
  account:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  system:   { bg: 'bg-surface-3',     text: 'text-text-muted', border: 'border-border'        },
  unknown:  { bg: 'bg-surface-3',     text: 'text-text-muted', border: 'border-border'        },
};
