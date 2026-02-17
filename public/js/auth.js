'use strict';

async function login() {
  const mobile = document.getElementById('mobile').value.trim();
  const msg = document.getElementById('msg');
  if (!mobile) { msg.textContent = 'Enter mobile number'; return; }

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  const data = await res.json();

  if (data.role === 'admin') {
    localStorage.setItem('mobile', mobile);
    location.href = '/admin.html';
  } else if (data.role === 'user') {
    localStorage.setItem('mobile', mobile);
    location.href = '/chat.html';
  } else {
    msg.textContent = data.msg || 'Error';
  }
}

async function signup() {
  const name = document.getElementById('name').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const msg = document.getElementById('msg');
  if (!name || !mobile) { msg.textContent = 'Fill all fields'; return; }

  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mobile }),
  });
  const data = await res.json();
  msg.textContent = data.msg || '';
}

// Allow Enter key on login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const loginBtn = document.querySelector('.auth-body button');
    if (loginBtn) loginBtn.click();
  }
});
