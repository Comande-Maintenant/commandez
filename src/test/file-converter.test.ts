import { describe, expect, it, vi } from 'vitest';
import { convertFileForAnalysis, translateError } from '@/utils/file-converter';
describe('Menu file preparation', () => {
  it('supports PDF files whose browser MIME type is empty', async () => {
    const file = await convertFileForAnalysis(new File(['%PDF-1.7'], 'carte.PDF', { type: '' }));
    expect(file.type).toBe('application/pdf');
  });
  it('rejects unsupported documents instead of uploading them as usable photos', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('not an image')));
    await expect(convertFileForAnalysis(new File(['text'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).rejects.toThrow();
  });
  it('translates conversion errors with their filename prefix', () => {
    expect(translateError('carte.heic: error.heic_convert|filename=carte.heic', (key) => key === 'error.heic_convert' ? 'Conversion de {filename} impossible' : key)).toBe('carte.heic: Conversion de carte.heic impossible');
  });
});
