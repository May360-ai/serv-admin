export function ubicacionParaConfirmar(): Promise<{ latitud: number; longitud: number; precision_m: number; capturada_en: string }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Este navegador no ofrece ubicación. Usa Android o contacta a despacho.')); return; }
    navigator.geolocation.getCurrentPosition(posicion => {
      resolve({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude,
        precision_m: posicion.coords.accuracy, capturada_en: new Date(posicion.timestamp).toISOString() });
    }, () => reject(new Error('No se pudo obtener tu ubicación. Permite la ubicación precisa y reintenta, o contacta a despacho.')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  });
}
