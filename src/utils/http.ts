import axios from 'axios';

// 2xx success means the same for reads and writes here: a POST that
// creates something legitimately answers 201 (and 204 No Content),
// and treating those as errors made callers report failures for
// requests that had actually succeeded.
const isSuccessStatus = (status: number) => status >= 200 && status < 300;

export default class Http {
  get(host: string, path: string, headers: any) {
    return new Promise((resolve, reject) => {
      const hostHeaders = {
        // 'Content-Type': 'application/json',
        ...headers,
      };

      axios
        .get(`https://${host}${path}`, {
          headers: hostHeaders,
          timeout: 15000,
        })
        .then((res: any) => {
          if (isSuccessStatus(res.status)) {
            resolve(res.data);
          } else {
            resolve({
              statuscode: res.status,
              headers: res.headers,
              body: res.data,
              message: 'Error fetching ' + host + path,
            });
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  post(host: string, path: string, headers: any, data: any) {
    return new Promise((resolve, reject) => {
      const hostHeaders = {
        // 'Content-Type': 'application/json',
        ...headers,
      };

      if (typeof data === 'object') {
        data = JSON.stringify(data);
      }

      axios
        .post(`https://${host}${path}`, data, {
          headers: hostHeaders,
          timeout: 15000,
        })
        .then((res: any) => {
          if (isSuccessStatus(res.status)) {
            resolve(res.data);
          } else {
            resolve({
              statuscode: res.status,
              headers: res.headers,
              body: res.data,
              message: 'Error fetching ' + host + path,
            });
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }
}
