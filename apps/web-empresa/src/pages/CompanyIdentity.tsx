import { useState } from 'react';

import { CompanyImagePicker } from '../components/CompanyImagePicker';
import { useToast } from '../components/Toast';
import { useUnsavedChanges } from '../components/UnsavedChanges';
import { IMAGE_LIMITS, type ImageKind } from '../lib/image-rules';
import { removeCompanyImage, uploadCompanyImage } from '../partner/media';
import { usePartner } from '../partner/PartnerContext';

/** Logo e banner da empresa: enviar, trocar e remover, em qualquer estado do cadastro (pendente, aprovada ou recusada). */
export function IdentitySection() {
  const { partner, reload } = usePartner();
  const [files, setFiles] = useState<Record<ImageKind, File | null>>({ logo: null, banner: null });
  const [busy, setBusy] = useState<ImageKind | null>(null);
  const toast = useToast();
  const [pickerKey, setPickerKey] = useState(0);

  useUnsavedChanges('settings-identity', files.logo !== null || files.banner !== null);

  if (!partner) return null;

  const current: Record<ImageKind, string | null> = { logo: partner.logo_url, banner: partner.banner_url };

  const save = async (kind: ImageKind) => {
    const file = files[kind];
    if (!file || busy) return;
    setBusy(kind);
    try {
      await uploadCompanyImage({ partnerId: partner.id, kind, file, currentUrl: current[kind] });
      setFiles((c) => ({ ...c, [kind]: null }));
      setPickerKey((k) => k + 1);
      await reload();
      toast.success(`${IMAGE_LIMITS[kind].name[0].toUpperCase()}${IMAGE_LIMITS[kind].name.slice(1)} atualizado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind: ImageKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      await removeCompanyImage({ partnerId: partner.id, kind, currentUrl: current[kind] });
      await reload();
      toast.success(`${IMAGE_LIMITS[kind].name[0].toUpperCase()}${IMAGE_LIMITS[kind].name.slice(1)} removido.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover a imagem.');
    } finally {
      setBusy(null);
    }
  };

  const block = (kind: ImageKind, label: string) => (
    <div className={`identity-block identity-${kind}`}>
      <CompanyImagePicker key={`${kind}-${pickerKey}`} kind={kind} label={label} optional={false} currentUrl={current[kind]} file={files[kind]} onChange={(f) => setFiles((c) => ({ ...c, [kind]: f }))} />
      <div className="actions">
        <button className="btn btn-primary btn-sm" onClick={() => save(kind)} disabled={!files[kind] || busy !== null}>
          {busy === kind ? 'Enviando…' : `Salvar ${IMAGE_LIMITS[kind].name}`}
        </button>
        {current[kind] ? (
          <button className="btn btn-ghost btn-sm" onClick={() => remove(kind)} disabled={busy !== null}>
            Remover
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="card">
      <h2 className="card-title">Identidade visual</h2>
      <p className="muted card-subtitle">A logo e o banner aparecem para os consumidores no app, depois da aprovação.</p>
      <div className="identity-grid">
        {block('logo', 'Logo')}
        {block('banner', 'Banner')}
      </div>
    </div>
  );
}
