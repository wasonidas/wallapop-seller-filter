import { normalizePreferences } from './core/filter.js';

const form = document.querySelector('#preferences');
const reviews = document.querySelector('#reviews');
const verified = document.querySelector('#verified');
const enabled = document.querySelector('#enabled');
const unchecked = document.querySelector('#unchecked');
const feedback = document.querySelector('#feedback');
const save = document.querySelector('#save');

try {
  const result = await chrome.storage.local.get('sellerPreferences');
  const preferences = normalizePreferences(result.sellerPreferences);
  reviews.value = String(preferences.minimumReviews);
  verified.checked = preferences.verifiedOnly;
  enabled.checked = preferences.enabled;
  unchecked.checked = preferences.showUnchecked;
  save.disabled = false;
} catch {
  feedback.textContent = 'No se han podido leer las preferencias. Vuelve a abrir la extensión.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const value = Number(reviews.value);
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999) return;
  save.disabled = true;
  try {
    await chrome.storage.local.set({
      sellerPreferences: normalizePreferences({
        minimumReviews: value,
        verifiedOnly: verified.checked,
        enabled: enabled.checked,
        showUnchecked: unchecked.checked,
      }),
    });
    feedback.textContent = 'Preferencias guardadas en este navegador.';
  } catch {
    feedback.textContent = 'No se han podido guardar las preferencias.';
  } finally {
    save.disabled = false;
  }
});

document.querySelector('#clear').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    feedback.textContent = response?.ok ? 'Caché borrada. Usa Actualizar datos en el panel para comprobar otra vez.' : 'No se pudo borrar la caché.';
  } catch { feedback.textContent = 'No se pudo borrar la caché.'; }
});
