import { useEffect, useState, type ChangeEvent } from 'react';

import { ACCEPTED_TYPES, IMAGE_LIMITS, validateImageFile, type ImageKind } from '../lib/image-rules';

type CompanyImagePickerProps = {
  kind: ImageKind;
  label: string;
  /** Imagem já salva (mostrada quando não há arquivo novo escolhido). */
  currentUrl?: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Mostra "(opcional)" no rótulo (cadastro). Nas configurações o rótulo fica só com o nome. */
  optional?: boolean;
};

/** Logo ou banner da empresa: valida tipo e tamanho ANTES de qualquer envio e mostra a pré-visualização. */
export function CompanyImagePicker({ kind, label, currentUrl = null, file, onChange, optional = true }: CompanyImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const limit = IMAGE_LIMITS[kind];

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    const problem = validateImageFile(picked, kind);
    if (problem) {
      event.target.value = '';
      onChange(null);
      return setError(problem);
    }
    setError('');
    onChange(picked);
  };

  const shown = preview ?? currentUrl;
  const inputId = `media-${kind}`;

  return (
    <div className="field">
      <label htmlFor={inputId}>{optional ? `${label} (opcional)` : label}</label>
      <div className={`media-preview media-${kind}`}>
        {shown ? <img src={shown} alt={`Pré-visualização do ${limit.name}`} /> : <span className="muted">Sem {limit.name}</span>}
      </div>
      <input id={inputId} type="file" accept={ACCEPTED_TYPES} onChange={handleChange} className="media-input" />
      {error ? (
        <span className="error" role="alert">{error}</span>
      ) : (
        <span className="hint">
          {limit.hint} JPEG, PNG ou WebP, até {limit.maxLabel}.
        </span>
      )}
    </div>
  );
}
