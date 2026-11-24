import { useEffect, useState, type ChangeEvent } from 'react';

import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../products/api';

type ImageInputProps = {
  currentUrl: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  onError: (message: string) => void;
};

/** Foto do produto: confere tipo e tamanho ANTES de qualquer envio e mostra a pré-visualização. */
export function ImageInput({ currentUrl, file, onChange, error, onError }: ImageInputProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (!IMAGE_TYPES[picked.type]) {
      event.target.value = '';
      return onError('A foto precisa ser JPEG, PNG ou WebP.');
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      event.target.value = '';
      return onError('A foto precisa ter no máximo 2 MB.');
    }
    onError('');
    onChange(picked);
  };

  const shown = preview ?? currentUrl;

  return (
    <div className="photo-box">
      {shown ? <img src={shown} alt="Foto do produto" /> : <p className="muted" style={{ padding: '40px 0' }}>Sem foto</p>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} aria-label="Foto do produto" />
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>JPEG, PNG ou WebP, até 2 MB.</p>
      {error ? <p className="error" style={{ color: 'var(--error)', fontSize: 13, marginTop: 6 }}>{error}</p> : null}
    </div>
  );
}
