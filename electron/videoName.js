/**
 * Shared video filename utilities used by main.js and coze.js
 */

function slugify(str, maxLen = 20) {
  return (str || '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '')
    .slice(0, maxLen);
}

/**
 * 生成单条视频文件名：YYYYMMDD_HHmmss_prompt_model_Xs.mp4
 * 示例：20250415_143022_榴莲跳舞_seedance2.0fast_5s.mp4
 */
function makeVideoName(prompt, model, duration) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const promptSlug = slugify(prompt, 20) || 'video';
  const modelSlug  = slugify(model, 16)  || 'video';
  const durStr = duration ? `${duration}s` : '';
  return `${dateStr}_${timeStr}_${promptSlug}_${modelSlug}${durStr ? '_' + durStr : ''}.mp4`;
}

module.exports = { slugify, makeVideoName };
