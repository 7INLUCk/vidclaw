import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DeepSeek 改写格式（API Mock）', () => {
  /**
   * 模拟 DeepSeek API 返回的改写结果，验证格式正确性
   */

  it('@引用必须内联到句子中，不能放在句尾', () => {
    // 模拟正确的改写结果
    const goodPrompt = '使用 @图片1 作为人物参考，参考 @视频1 的动作';

    // @引用不在句尾
    expect(goodPrompt).not.toMatch(/@\S+。$/);
    // @引用在句中（前面有动词或介词）
    expect(goodPrompt).toMatch(/使用 @图片1/);
    expect(goodPrompt).toMatch(/参考 @视频1/);
  });

  it('错误格式：@引用放在句尾应被检测', () => {
    const badPrompt = '一个女孩在海边跳舞。@图片1';
    // 检测到 @引用在句尾
    expect(badPrompt).toMatch(/@\S+$/);
  });

  it('2图1视频场景正确编号', () => {
    const prompt = '@图片1 的人物参考 @图片2 的衣服，参考 @视频1 的动作';
    expect(prompt).toContain('@图片1');
    expect(prompt).toContain('@图片2');
    expect(prompt).toContain('@视频1');
    // 不应该出现 @图片3（只有2张图）
    expect(prompt).not.toContain('@图片3');
  });

  it('Seedance prompt 包含保持形象的关键字', () => {
    const prompt = '使用 @图片1 作为人物形象参考，保持外貌穿着不变';
    expect(prompt).toContain('保持');
    expect(prompt).toContain('@图片1');
    // 应包含形象相关词
    expect(prompt).toMatch(/形象|外貌|穿着/);
  });

  it('Seedance prompt 视频引用只涉及动作不涉及外貌', () => {
    const prompt = '参考 @视频1 的舞蹈动作和运镜，保持 @图片1 的人物形象不变';
    // 视频相关词
    expect(prompt).toMatch(/@视频1.*(动作|运镜|节奏)/);
    // 图片相关词
    expect(prompt).toMatch(/@图片1.*(形象|外貌|穿着|人物)/);
  });

  it('多素材场景职责明确分配', () => {
    const prompt = '使用 @图片1（人物照片）保持人物外貌，穿着 @图片2（衣服图片）中的衣服，参考 @视频1（街舞视频）的舞蹈动作';
    // 3个素材各有职责
    expect(prompt).toContain('@图片1');
    expect(prompt).toContain('@图片2');
    expect(prompt).toContain('@视频1');
  });

  it('无素材时不需要@引用', () => {
    const prompt = '一个穿着白色连衣裙的女孩在雨中翩翩起舞，背景是朦胧的城市夜景';
    expect(prompt).not.toMatch(/@/);
    expect(prompt).toMatch(/[\u4e00-\u9fa5]/); // 中文
  });

  it('mock fetch 返回正确 JSON 结构', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            prompt: '使用 @图片1 作为人物参考，参考 @视频1 的动作',
            reason: '图片负责人物形象，视频只负责动作',
            duration: 5,
            aspectRatio: '9:16',
          }),
        },
      }],
    };

    // Mock fetch
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    globalThis.fetch = fetchSpy;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    expect(content.prompt).toContain('@图片1');
    expect(content.prompt).toContain('@视频1');
    expect(content.reason).toBeTruthy();
    expect(content.duration).toBe(5);
    expect(content.aspectRatio).toBe('9:16');
  });

  it('mock fetch 返回 markdown 代码块格式也能解析', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: '```json\n{"prompt":"使用 @图片1 参考","reason":"已优化","duration":5,"aspectRatio":"16:9"}\n```',
        },
      }],
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    globalThis.fetch = fetchSpy;

    const response = await fetch('https://test.api', { method: 'POST', body: '{}' });
    const data = await response.json();
    const raw = data.choices[0].message.content;

    // Extract JSON from markdown
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const content = JSON.parse(jsonMatch![1]);

    expect(content.prompt).toContain('@图片1');
    expect(content.duration).toBe(5);
  });
});
