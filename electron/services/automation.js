/**
 * automation.js - 已废弃，保留空导出防止引用报错
 * 
 * 原功能（Playwright 浏览器自动化）已全链路迁移到即梦官方 CLI (dreamina)
 * 参考：https://github.com/7INLUCk/vidclaw/issues/14
 */

const MODEL_MAP = {
  'seedance_2.0_fast': { key: 'dreamina_seedance_40', label: 'Seedance 2.0 Fast', benefit: 'dreamina_seedance_20_fast_with_video' },
  'seedance_2.0': { key: 'dreamina_seedance_20', label: 'Seedance 2.0', benefit: 'dreamina_seedance_20_with_video' },
};

const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const JIMENG_GENERATE_URL = 'https://jimeng.jianying.com/ai-tool/generate';

// 空导出，防止其他文件引用报错
module.exports = { 
  AutomationService: class AutomationService {
    constructor() {
      console.warn('[automation.js] 已废弃，请使用即梦 CLI');
    }
  },
  parseItem: () => null,
  parseApiResponse: () => [],
  getLargestUrl: () => '',
  MODEL_MAP,
  ASPECT_RATIOS,
  JIMENG_GENERATE_URL,
};