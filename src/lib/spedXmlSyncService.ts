import { SpedData, XmlRecord } from '../types';

export async function fetchSpedXmlCloud(escritorioId?: string): Promise<{ spedData: SpedData | null; xmlTerceiros: XmlRecord[]; xmlProprio: XmlRecord[]; xmlNfce: XmlRecord[] } | null> {
  const eid = escritorioId || localStorage.getItem('atlas_escritorio_id') || 'escritorio-default';
  const token = localStorage.getItem('atlas_auth_token');

  try {
    const res = await fetch(`/api/escritorio/sped-xml?escritorioId=${eid}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        return {
          spedData: data.data.spedData || null,
          xmlTerceiros: data.data.xmlTerceiros || [],
          xmlProprio: data.data.xmlProprio || [],
          xmlNfce: data.data.xmlNfce || []
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching SPED/XML from cloud API:', err);
  }
  return null;
}

export async function saveSpedXmlCloud(
  payload: {
    spedData: SpedData | null;
    xmlTerceiros: XmlRecord[];
    xmlProprio: XmlRecord[];
    xmlNfce: XmlRecord[];
  },
  escritorioId?: string
): Promise<boolean> {
  const eid = escritorioId || localStorage.getItem('atlas_escritorio_id') || 'escritorio-default';
  const token = localStorage.getItem('atlas_auth_token');

  try {
    const res = await fetch('/api/escritorio/sped-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        escritorioId: eid,
        ...payload
      })
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn('Error saving SPED/XML to cloud API:', err);
  }
  return false;
}
