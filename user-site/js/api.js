const TOKEN_KEY = "ve_token";

const Api = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request(method, path, { params, body } = {}) {
    let url = API_BASE_URL + path;
    if (params) {
      const usp = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
      );
      const qs = usp.toString();
      if (qs) url += "?" + qs;
    }

    const headers = { "Content-Type": "application/json" };
    const token = Api.getToken();
    if (token) headers.Authorization = "Bearer " + token;

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  get(path, params) { return Api.request("GET", path, { params }); },
  post(path, body) { return Api.request("POST", path, { body }); },
  put(path, body) { return Api.request("PUT", path, { body }); },
  patch(path, body) { return Api.request("PATCH", path, { body }); },
  del(path) { return Api.request("DELETE", path); },
};
