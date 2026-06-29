const saveOptions = () => {
  const apiKey = document.getElementById('apiKey').value;
  const baseUrl = document.getElementById('baseUrl').value;
  const model = document.getElementById('model').value;
  const syncUrl = document.getElementById('syncUrl').value;
  const accessPassword = document.getElementById('accessPassword').value;

  chrome.storage.local.set(
    { apiKey, baseUrl, model, syncUrl, accessPassword },
    () => {
      const status = document.getElementById('status');
      status.style.display = 'block';
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    }
  );
};

const restoreOptions = () => {
  chrome.storage.local.get(
    { 
      apiKey: '', 
      baseUrl: 'https://api.openai.com/v1', 
      model: 'gpt-3.5-turbo',
      syncUrl: 'http://localhost:3999',
      accessPassword: ''
    },
    (items) => {
      document.getElementById('apiKey').value = items.apiKey;
      document.getElementById('baseUrl').value = items.baseUrl;
      document.getElementById('model').value = items.model;
      document.getElementById('syncUrl').value = items.syncUrl;
      document.getElementById('accessPassword').value = items.accessPassword;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
