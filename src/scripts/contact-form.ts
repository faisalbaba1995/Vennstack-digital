const FORM_SELECTOR = '#contact-form';
const STATUS_SELECTOR = '#contact-form-status';
const TIMEOUT_MS = 12_000;

let disposeCurrent: (() => void) | undefined;

export function setupContactForm(root: ParentNode = document): () => void {
  const form = root.querySelector<HTMLFormElement>(FORM_SELECTOR);
  const status = root.querySelector<HTMLElement>(STATUS_SELECTOR);
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !status || !submit) return () => {};

  let activeController: AbortController | undefined;
  let disposed = false;
  const defaultLabel = 'SEND SIGNAL';

  const setStatus = (message: string, state: 'idle' | 'pending' | 'success' | 'error') => {
    status.textContent = message;
    status.dataset.state = state;
    submit.disabled = state === 'pending';
    submit.setAttribute('aria-disabled', String(state === 'pending'));
    const label = submit.querySelector<HTMLElement>('.contact__submit-text');
    if (label) label.textContent = state === 'pending' ? 'SENDING…' : defaultLabel;
  };

  if (submit.disabled) setStatus('Sending was interrupted. Your message is still here; please retry.', 'error');

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (activeController || disposed) return;
    if (!form.reportValidity()) return;

    const controller = new AbortController();
    activeController = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);
    setStatus('Sending your message…', 'pending');

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      let payload: { success?: boolean; message?: string };
      try {
        payload = await response.json();
      } catch {
        throw new Error('The form service returned an unreadable response. Please email us instead.');
      }

      if (disposed || controller.signal.aborted) return;
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(payload?.message || 'Your message could not be sent. Please try again or email us.');
      }

      form.reset();
      setStatus('Message sent. We’ll be in touch.', 'success');
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
      const message = controller.signal.reason === 'timeout'
        ? 'Sending timed out. Your message is still here; please retry or email us.'
        : error instanceof Error ? error.message : 'A network error occurred. Please retry or email us.';
      setStatus(message, 'error');
    } finally {
      window.clearTimeout(timeout);
      if (activeController === controller) activeController = undefined;
    }
  };

  form.addEventListener('submit', handleSubmit);
  return () => {
    disposed = true;
    form.removeEventListener('submit', handleSubmit);
    activeController?.abort('dispose');
  };
}

function mount() {
  disposeCurrent?.();
  disposeCurrent = setupContactForm();
}

document.addEventListener('astro:page-load', mount);
document.addEventListener('astro:before-swap', () => {
  disposeCurrent?.();
  disposeCurrent = undefined;
});
window.addEventListener('pagehide', () => { disposeCurrent?.(); disposeCurrent = undefined; });
window.addEventListener('pageshow', (event) => { if (event.persisted) mount(); });

mount();
