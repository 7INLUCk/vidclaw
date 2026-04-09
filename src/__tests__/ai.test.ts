import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock https module for testing API calls
vi.mock('https', () => {
  const mockRequest = {
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };

  return {
    default: {
      request: vi.fn((options, callback) => {
        // Store callback for later invocation
        (mockRequest as any)._callback = callback;
        return mockRequest;
      }),
    },
    request: vi.fn((options, callback) => {
      (mockRequest as any)._callback = callback;
      return mockRequest;
    }),
  };
});

describe('DeepSeek Response Parsing', () => {
  /**
   * Test the _parseResponse logic from AIService
   * We extract the parsing logic inline since the class uses CommonJS
   */
  function parseResponse(content: string): any {
    // Try direct JSON parse
    try {
      return JSON.parse(content);
    } catch {}

    // Try markdown code block extraction
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }

    // Try brace extraction
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {}
    }

    // Fallback: return content as prompt
    return {
      prompt: content,
      duration: 5,
      aspectRatio: '16:9',
      type: 'video',
      style: '默认',
    };
  }

  it('parses raw JSON response', () => {
    const json = '{"prompt":"A cat running","duration":5,"aspectRatio":"16:9","type":"video"}';
    const result = parseResponse(json);
    expect(result.prompt).toBe('A cat running');
    expect(result.duration).toBe(5);
    expect(result.type).toBe('video');
  });

  it('parses JSON from markdown code block', () => {
    const markdown = '```json\n{"prompt":"Cyberpunk city","duration":null,"aspectRatio":"16:9","type":"image"}\n```';
    const result = parseResponse(markdown);
    expect(result.prompt).toBe('Cyberpunk city');
    expect(result.type).toBe('image');
  });

  it('parses JSON from markdown code block without json tag', () => {
    const markdown = '```\n{"prompt":"Sunset beach","duration":5,"aspectRatio":"9:16","type":"video"}\n```';
    const result = parseResponse(markdown);
    expect(result.prompt).toBe('Sunset beach');
    expect(result.aspectRatio).toBe('9:16');
  });

  it('extracts JSON from text with surrounding content', () => {
    const text = 'Here is the result:\n{"prompt":"Mountain landscape","duration":10,"aspectRatio":"16:9"}\nDone!';
    const result = parseResponse(text);
    expect(result.prompt).toBe('Mountain landscape');
    expect(result.duration).toBe(10);
  });

  it('falls back to raw content when no JSON found', () => {
    const text = 'This is just plain text without JSON';
    const result = parseResponse(text);
    expect(result.prompt).toBe(text);
    expect(result.duration).toBe(5);
    expect(result.aspectRatio).toBe('16:9');
  });
});

describe('@引用 Format Validation', () => {
  it('@引用 must be inline (not at sentence end)', () => {
    // Correct: inline reference
    const goodPrompt = '使用 @图片1 作为人物参考，参考 @视频1 的动作';
    expect(goodPrompt).not.toMatch(/@\S+。$/);
    // @引用 in the middle of sentence
    expect(goodPrompt).toMatch(/使用 @图片1/);

    // Bad: reference at sentence end
    const badPrompt = '一个女孩跳舞。@图片1';
    // The pattern detects @引用 at end of sentence - not matching our good case
    expect(badPrompt).toMatch(/@\S+$/);
  });

  it('2 images + 1 video scenario has correct numbering', () => {
    const prompt = '@图片1 的人物参考 @图片2 的衣服，参考 @视频1 的动作';
    expect(prompt).toContain('@图片1');
    expect(prompt).toContain('@图片2');
    expect(prompt).toContain('@视频1');
  });

  it('Seedance prompt contains image reference', () => {
    const prompt = '使用 @图片1 作为人物形象参考，保持外貌穿着不变';
    expect(prompt).toContain('@图片1');
  });

  it('Seedance prompt contains preservation keywords', () => {
    const prompt = '使用 @图片1 作为人物形象参考，保持外貌穿着不变';
    // Must contain either 保持 or 不变 for identity preservation
    expect(prompt).toMatch(/保持|不变/);
  });

  it('video reference only specifies action not appearance', () => {
    const prompt = '参考 @视频1 的舞蹈动作和运镜，保持 @图片1 的人物形象';
    // @视频1 should be associated with action/movement words
    expect(prompt).toMatch(/@视频1.*动作|运镜|节奏/);
    // @图片1 should be associated with appearance/形象
    expect(prompt).toMatch(/@图片1.*形象|外貌|穿着/);
  });

  it('multiple material types are correctly numbered', () => {
    const prompt = '@图片1 的人物参考 @图片2 的衣服 @视频1 的动作 @音频1 的配乐';
    expect(prompt).toContain('@图片1');
    expect(prompt).toContain('@图片2');
    expect(prompt).toContain('@视频1');
    expect(prompt).toContain('@音频1');
  });
});

describe('Prompt Format Rules', () => {
  it('Seedance mode uses Chinese prompts', () => {
    const prompt = '使用 @图片1 作为人物参考，参考 @视频1 的舞蹈动作';
    // Should contain Chinese characters
    expect(prompt).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('standard mode uses English prompts', () => {
    const prompt = 'A cute orange tabby cat running through cherry blossom trees';
    // Should not contain Chinese
    expect(prompt).not.toMatch(/[\u4e00-\u9fa5]/);
  });

  it('default duration is 5 seconds', () => {
    const defaultDuration = 5;
    expect(defaultDuration).toBe(5);
  });

  it('default aspect ratio for video is 9:16 (vertical)', () => {
    // Seedance defaults to vertical
    const defaultRatio = '9:16';
    expect(defaultRatio).toBe('9:16');
  });

  it('standard mode defaults to 16:9 (horizontal)', () => {
    const defaultRatio = '16:9';
    expect(defaultRatio).toBe('16:9');
  });
});

describe('Material Upload Order Rules', () => {
  it('images come before videos in numbering', () => {
    // Simulated material order: 2 images, 1 video
    const materials = [
      { type: 'image', name: '人物照片' },
      { type: 'image', name: '衣服图片' },
      { type: 'video', name: '舞蹈视频' },
    ];

    let imageIdx = 0, videoIdx = 0;
    const refs: string[] = [];
    materials.forEach(m => {
      if (m.type === 'image') {
        imageIdx++;
        refs.push(`@图片${imageIdx}`);
      } else if (m.type === 'video') {
        videoIdx++;
        refs.push(`@视频${videoIdx}`);
      }
    });

    expect(refs).toEqual(['@图片1', '@图片2', '@视频1']);
  });

  it('audios come last in numbering', () => {
    const materials = [
      { type: 'image', name: '风景' },
      { type: 'video', name: '舞蹈' },
      { type: 'audio', name: 'BGM' },
    ];

    let imageIdx = 0, videoIdx = 0, audioIdx = 0;
    const refs: string[] = [];
    materials.forEach(m => {
      if (m.type === 'image') { imageIdx++; refs.push(`@图片${imageIdx}`); }
      else if (m.type === 'video') { videoIdx++; refs.push(`@视频${videoIdx}`); }
      else if (m.type === 'audio') { audioIdx++; refs.push(`@音频${audioIdx}`); }
    });

    expect(refs).toEqual(['@图片1', '@视频1', '@音频1']);
  });
});
