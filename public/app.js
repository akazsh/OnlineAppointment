const state = { user: null, category: '', provider: null, selectedTime: '', authMode: 'login', selectedRole: 'customer', providers: [] };
const elements = {
  providerGrid: document.querySelector('#provider-grid'),
  providerDialog: document.querySelector('#provider-dialog'),
  providerContent: document.querySelector('#provider-modal-content'),
  authDialog: document.querySelector('#auth-dialog'),
  authContent: document.querySelector('#auth-modal-content'),
  toast: document.querySelector('#toast'),
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

let toastTimer;
function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 3200);
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

function formatPrice(cents) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function formatTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function updateAccountControls() {
  const trigger = document.querySelector('#auth-trigger');
  const appointmentsNav = document.querySelector('#appointments-nav');
  if (state.user) {
    trigger.textContent = `${state.user.name.split(' ')[0]}  ·  Sign out`;
    appointmentsNav.textContent = 'My appointments';
    document.querySelector('#provider-cta').textContent = state.user.role === 'provider' ? 'Your practice' : 'List your practice';
  } else {
    trigger.textContent = 'Sign in';
    appointmentsNav.textContent = 'My appointments';
    document.querySelector('#provider-cta').textContent = 'List your practice';
  }
}

function cardMarkup(provider, index) {
  const image = provider.photo_url
    ? `<img class="provider-photo" src="${escapeHtml(provider.photo_url)}" alt="${escapeHtml(provider.name)}" loading="lazy">`
    : `<div class="provider-photo photo-placeholder tone-${index % 6}"><span>${escapeHtml(initials(provider.name))}</span><i>${escapeHtml(provider.category)}</i></div>`;
  return `<article class="provider-card" tabindex="0" role="button" data-provider-id="${provider.id}" aria-label="View ${escapeHtml(provider.business_name)}">
    <div class="provider-image">${image}<span class="image-index">0${index + 1}</span><span class="image-open" aria-hidden="true">↗</span></div>
    <div class="provider-card-body">
      <div class="card-category">${escapeHtml(provider.category)}<span class="rating"><span>★</span> ${Number(provider.rating).toFixed(1)}</span></div>
      <h3>${escapeHtml(provider.business_name)}</h3>
      <p class="provider-name">with ${escapeHtml(provider.name)}</p>
      <div class="card-footer"><span class="card-location">${escapeHtml(provider.location)}</span><span class="card-price">${formatPrice(provider.price_cents)} <small>/ ${provider.duration_minutes} min</small></span></div>
    </div>
  </article>`;
}

async function loadProviders() {
  const query = document.querySelector('#search-input').value.trim();
  const location = document.querySelector('#location-input').value.trim().toLowerCase();
  const parameters = new URLSearchParams();
  if (query) parameters.set('search', query);
  if (state.category) parameters.set('category', state.category);
  elements.providerGrid.innerHTML = '<div class="loading-state"><span class="loading-dot"></span> Finding your people...</div>';
  try {
    const allProviders = await api(`/api/providers?${parameters}`);
    state.providers = allProviders.filter((provider) => !location || provider.location.toLowerCase().includes(location));
    elements.providerGrid.innerHTML = state.providers.map(cardMarkup).join('');
    document.querySelector('#results-count').textContent = `${state.providers.length} ${state.providers.length === 1 ? 'practice' : 'practices'}`;
    document.querySelector('#empty-state').classList.toggle('hidden', state.providers.length > 0);
  } catch (error) {
    elements.providerGrid.innerHTML = `<div class="load-error"><strong>We couldn't load the directory.</strong><span>${escapeHtml(error.message)}</span></div>`;
    document.querySelector('#results-count').textContent = '';
    document.querySelector('#empty-state').classList.add('hidden');
  }
}

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function openProvider(provider) {
  state.provider = provider;
  state.selectedTime = '';
  const today = todayString();
  elements.providerContent.innerHTML = `<button class="modal-close" type="button" data-close="provider-dialog" aria-label="Close">×</button>
    <div class="provider-detail-hero">${provider.photo_url ? `<img src="${escapeHtml(provider.photo_url)}" alt="${escapeHtml(provider.name)}">` : `<div class="detail-placeholder">${escapeHtml(initials(provider.name))}</div>`}<div class="detail-intro"><p class="eyebrow muted-eyebrow">${escapeHtml(provider.category)} <span class="detail-rating">★ ${Number(provider.rating).toFixed(1)}</span></p><h2 id="provider-dialog-title">${escapeHtml(provider.business_name)}</h2><p class="detail-byline">A practice by ${escapeHtml(provider.name)} · ${escapeHtml(provider.location)}</p></div></div>
    <p class="provider-bio">${escapeHtml(provider.bio || 'A thoughtful, personal service shaped around you.')}</p>
    <div class="detail-meta"><span><strong>${formatPrice(provider.price_cents)}</strong> per visit</span><span><strong>${provider.duration_minutes} min</strong> together</span><span><strong>★ ${Number(provider.rating).toFixed(1)}</strong> community rating</span></div>
    <div class="booking-section"><div class="booking-heading"><div><p class="eyebrow muted-eyebrow">MAKE A LITTLE ROOM</p><h3>Pick a day & time</h3></div><label class="date-picker"><span class="field-caption">YOUR DAY</span><input id="booking-date" type="date" min="${today}" value="${today}"></label></div><div class="slot-list" id="slot-list"><span class="slot-loading">Finding available times...</span></div>
      <label class="notes-label hidden" id="notes-label">Anything you'd like them to know? <textarea id="booking-notes" maxlength="500" placeholder="Optional note for your provider"></textarea></label><button class="button button-coral booking-submit hidden" id="booking-submit" type="button">Book this visit <span aria-hidden="true">↗</span></button>
      <p class="booking-footnote">Appointments are confirmed when you book. Free cancellation before your visit.</p>
    </div>`;
  elements.providerDialog.showModal();
  loadSlots(today);
}

async function loadSlots(date) {
  const slotList = document.querySelector('#slot-list');
  slotList.innerHTML = '<span class="slot-loading">Finding available times...</span>';
  document.querySelector('#booking-submit').classList.add('hidden');
  document.querySelector('#notes-label').classList.add('hidden');
  state.selectedTime = '';
  try {
    const { slots } = await api(`/api/providers/${state.provider.id}/slots?date=${encodeURIComponent(date)}`);
    slotList.innerHTML = slots.length
      ? slots.map((time) => `<button class="time-slot" type="button" data-time="${time}">${formatTime(time)}</button>`).join('')
      : '<span class="no-slots">No openings on this day. Try another date.</span>';
  } catch (error) {
    slotList.innerHTML = `<span class="no-slots">${escapeHtml(error.message)}</span>`;
  }
}

function openAuth(mode = 'login', role = 'customer') {
  state.authMode = mode;
  state.selectedRole = role;
  renderAuth();
  elements.authDialog.showModal();
}

function renderAuth() {
  const isRegister = state.authMode === 'register';
  const isProvider = state.selectedRole === 'provider';
  elements.authContent.innerHTML = `<button class="modal-close" type="button" data-close="auth-dialog" aria-label="Close">×</button>
    <p class="eyebrow muted-eyebrow">${isRegister ? 'A FRESH START' : 'WELCOME BACK'}</p><h2 id="auth-title">${isRegister ? (isProvider ? 'Put your practice out there.' : 'Your time, well spent.') : 'Good to see you.'}</h2><p class="auth-intro">${isRegister ? (isProvider ? 'Create a provider profile and meet the right people.' : 'Create an account to book and keep track of your visits.') : 'Sign in to find your next good thing.'}</p>
    <form id="auth-form" class="form-stack">
      ${isRegister ? `<label>Your name<input name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Name you go by"></label>` : ''}
      <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label>
      <label>Password<input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required minlength="${isRegister ? '8' : '1'}" placeholder="${isRegister ? 'At least 8 characters' : 'Your password'}"></label>
      ${isRegister ? `<label>I'm joining as<select name="role" id="account-role"><option value="customer" ${!isProvider ? 'selected' : ''}>A customer</option><option value="provider" ${isProvider ? 'selected' : ''}>A service provider</option></select></label>
        <div class="provider-fields ${isProvider ? '' : 'hidden'}" id="provider-fields">
          <label>Practice or business name<input name="businessName" maxlength="120" placeholder="The name people know you by" ${isProvider ? 'required' : ''}></label>
          <div class="form-two"><label>Service category<input name="category" maxlength="60" placeholder="e.g. Massage" ${isProvider ? 'required' : ''}></label><label>Location<input name="location" maxlength="120" placeholder="City or Remote" ${isProvider ? 'required' : ''}></label></div>
          <label>Short introduction<textarea name="bio" maxlength="1000" placeholder="What makes your practice yours?"></textarea></label>
          <div class="form-two"><label>Visit length<select name="duration"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60" selected>60 minutes</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label><label>Price per visit<input name="price" type="number" min="0" max="10000" step="1" value="50" required></label></div>
          <p class="form-hint">Your listing appears in provider search as soon as your account is created.</p>
        </div>` : ''}
      <p class="form-error hidden" id="auth-error" role="alert"></p><button class="button button-dark form-submit" type="submit">${isRegister ? (isProvider ? 'Create provider profile' : 'Create account') : 'Sign in'} <span aria-hidden="true">↗</span></button>
    </form><p class="auth-switch">${isRegister ? 'Already have an account?' : 'New to Goodspace?'} <button type="button" id="auth-switch">${isRegister ? 'Sign in' : 'Create an account'}</button></p>`;
}

function showAppointments() {
  document.querySelector('#explore-view').classList.add('hidden');
  document.querySelector('#appointments-view').classList.remove('hidden');
  document.querySelector('#explore-nav').classList.remove('active');
  document.querySelector('#appointments-nav').classList.add('active');
  loadAppointments();
}

function showExplore() {
  document.querySelector('#appointments-view').classList.add('hidden');
  document.querySelector('#explore-view').classList.remove('hidden');
  document.querySelector('#appointments-nav').classList.remove('active');
  document.querySelector('#explore-nav').classList.add('active');
}

async function loadAppointments() {
  const list = document.querySelector('#appointment-list');
  const summary = document.querySelector('#dashboard-summary');
  const heading = document.querySelector('#dashboard-title');
  heading.innerHTML = `${state.user.role === 'provider' ? 'Your practice' : 'Your appointments'}<span class="heading-period">.</span>`;
  list.innerHTML = '<div class="loading-state"><span class="loading-dot"></span> Gathering your visits...</div>';
  try {
    const appointments = await api('/api/appointments');
    const upcoming = appointments.filter((item) => item.status === 'confirmed');
    summary.innerHTML = `<div class="summary-item"><span>UP NEXT</span><strong>${upcoming.length}</strong></div><div class="summary-item"><span>ALL VISITS</span><strong>${appointments.length}</strong></div><div class="summary-note">${upcoming.length ? 'Your next good thing is on the calendar.' : 'A little room in your calendar. Make it yours.'}</div>`;
    if (!appointments.length) {
      list.innerHTML = `<div class="dashboard-empty"><span class="empty-stamp">✳</span><h2>Nothing on the calendar yet.</h2><p>${state.user.role === 'provider' ? 'Your practice is listed. New appointments will show up here.' : 'Find someone who feels right, then book a time that works.'}</p>${state.user.role === 'customer' ? '<button class="button button-coral" id="empty-explore" type="button">Explore providers ↗</button>' : ''}</div>`;
      return;
    }
    list.innerHTML = appointments.map((item) => `<article class="appointment-item">
      <div class="appointment-date"><strong>${new Date(`${item.date}T12:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(`${item.date}T12:00:00`)).toUpperCase()}</span></div>
      <div class="appointment-main"><span class="appointment-category">${escapeHtml(item.category)} · ${escapeHtml(item.status)}</span><h3>${state.user.role === 'provider' ? escapeHtml(item.client_name) : escapeHtml(item.business_name)}</h3><p>${state.user.role === 'provider' ? `Visit with ${escapeHtml(item.client_name)}` : `with ${escapeHtml(item.provider_name)}`} · ${escapeHtml(item.location)}</p></div>
      <div class="appointment-time"><strong>${formatTime(item.time)}</strong><span>${formatDate(item.date)}</span></div>
      <div class="appointment-actions">${item.status === 'confirmed' ? `${state.user.role === 'provider' ? `<button class="text-action" data-appointment-id="${item.id}" data-status="completed" type="button">Mark complete</button>` : ''}<button class="text-action cancel-action" data-appointment-id="${item.id}" data-status="cancelled" type="button">Cancel</button>` : `<span class="status-note">${item.status === 'completed' ? 'All wrapped up' : 'Visit cancelled'}</span>`}</div>
    </article>`).join('');
  } catch (error) {
    list.innerHTML = `<div class="load-error">${escapeHtml(error.message)}</div>`;
  }
}

document.querySelector('#search-button').addEventListener('click', loadProviders);
document.querySelector('#search-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadProviders(); });
document.querySelector('#location-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadProviders(); });
document.querySelector('#category-row').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  document.querySelectorAll('.category-chip').forEach((chip) => chip.classList.toggle('selected', chip === button));
  loadProviders();
});
document.querySelector('#provider-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-provider-id]');
  if (card) openProvider(state.providers.find((provider) => provider.id === Number(card.dataset.providerId)));
});
document.querySelector('#provider-grid').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    const card = event.target.closest('[data-provider-id]');
    if (card) { event.preventDefault(); openProvider(state.providers.find((provider) => provider.id === Number(card.dataset.providerId))); }
  }
});
document.querySelector('#empty-state').addEventListener('click', (event) => {
  if (event.target.closest('#clear-search')) {
    document.querySelector('#search-input').value = '';
    document.querySelector('#location-input').value = '';
    state.category = '';
    document.querySelectorAll('.category-chip').forEach((chip) => chip.classList.toggle('selected', !chip.dataset.category));
    loadProviders();
  }
});
document.querySelector('#provider-cta').addEventListener('click', () => {
  if (state.user?.role === 'provider') showAppointments();
  else if (state.user) toast('Sign out first to create a separate provider account.');
  else openAuth('register', 'provider');
});
document.querySelector('#auth-trigger').addEventListener('click', async () => {
  if (!state.user) return openAuth();
  try {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    updateAccountControls();
    showExplore();
    toast('You are signed out. See you soon.');
  } catch (error) { toast(error.message); }
});
document.querySelector('#appointments-nav').addEventListener('click', () => {
  if (!state.user) return openAuth();
  showAppointments();
});
document.querySelector('#explore-nav').addEventListener('click', showExplore);
document.querySelector('#back-to-explore').addEventListener('click', showExplore);
document.querySelector('#appointment-list').addEventListener('click', async (event) => {
  if (event.target.closest('#empty-explore')) return showExplore();
  const button = event.target.closest('[data-appointment-id]');
  if (!button) return;
  try {
    await api(`/api/appointments/${button.dataset.appointmentId}`, { method: 'PATCH', body: { status: button.dataset.status } });
    toast(button.dataset.status === 'completed' ? 'Marked as complete.' : 'Appointment cancelled.');
    loadAppointments();
  } catch (error) { toast(error.message); }
});

elements.providerDialog.addEventListener('click', async (event) => {
  if (event.target.closest('[data-close="provider-dialog"]')) return elements.providerDialog.close();
  const dateInput = event.target.closest('#booking-date');
  if (dateInput) return;
  const timeButton = event.target.closest('[data-time]');
  if (timeButton) {
    state.selectedTime = timeButton.dataset.time;
    document.querySelectorAll('.time-slot').forEach((button) => button.classList.toggle('selected', button === timeButton));
    document.querySelector('#notes-label').classList.remove('hidden');
    document.querySelector('#booking-submit').classList.remove('hidden');
  }
  if (event.target.closest('#booking-submit')) {
    if (!state.user) { elements.providerDialog.close(); return openAuth(); }
    if (state.user.role !== 'customer') return toast('Sign in with a customer account to book a visit.');
    const button = document.querySelector('#booking-submit');
    button.disabled = true;
    try {
      await api('/api/appointments', { method: 'POST', body: { providerId: state.provider.id, date: document.querySelector('#booking-date').value, time: state.selectedTime, notes: document.querySelector('#booking-notes').value } });
      elements.providerDialog.close();
      toast('You’re booked. A little time, just for you.');
      showAppointments();
    } catch (error) { toast(error.message); button.disabled = false; }
  }
});
elements.providerDialog.addEventListener('change', (event) => {
  if (event.target.id === 'booking-date') loadSlots(event.target.value);
});

elements.authDialog.addEventListener('click', (event) => {
  if (event.target.closest('[data-close="auth-dialog"]')) return elements.authDialog.close();
  if (event.target.closest('#auth-switch')) {
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    renderAuth();
  }
});
elements.authDialog.addEventListener('change', (event) => {
  if (event.target.id !== 'account-role') return;
  state.selectedRole = event.target.value;
  const fields = document.querySelector('#provider-fields');
  fields.classList.toggle('hidden', state.selectedRole !== 'provider');
  fields.querySelectorAll('input[name="businessName"], input[name="category"], input[name="location"]').forEach((field) => { field.required = state.selectedRole === 'provider'; });
  renderAuth();
});
elements.authDialog.addEventListener('submit', async (event) => {
  if (event.target.id !== 'auth-form') return;
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form).entries());
  const mode = state.authMode;
  const errorText = document.querySelector('#auth-error');
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  errorText.classList.add('hidden');
  try {
    const userData = await api(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { method: 'POST', body: values });
    state.user = userData.user;
    updateAccountControls();
    elements.authDialog.close();
    toast(mode === 'register' ? 'Welcome to Goodspace.' : `Welcome back, ${state.user.name.split(' ')[0]}.`);
    if (state.user.role === 'provider') showAppointments();
  } catch (error) {
    errorText.textContent = error.message;
    errorText.classList.remove('hidden');
    submit.disabled = false;
  }
});

async function initialize() {
  try {
    const result = await api('/api/me');
    state.user = result.user;
    updateAccountControls();
    if (state.user?.role === 'provider') document.querySelector('#provider-cta').textContent = 'Your practice';
  } catch (error) { toast(error.message); }
  loadProviders();
}

initialize();