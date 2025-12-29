import axios, { AxiosInstance } from 'axios';
import { DownloadClient } from './base.js';
import { getConfig } from '../utils/config.js';

/**
 * pyLoad client via REST API
 * Documentation: https://github.com/pyload/pyload/wiki/API
 */
export class PyLoadClient implements DownloadClient {
  name = 'pyLoad';
  private session: string | null = null;

  isEnabled(): boolean {
    const config = getConfig().pyload;
    return config.enabled && !!config.host;
  }

  private getBaseUrl(): string {
    const config = getConfig().pyload;
    const protocol = config.useSsl ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  private async login(): Promise<string> {
    const config = getConfig().pyload;
    const url = `${this.getBaseUrl()}/api/login`;

    const response = await axios.post(url, null, {
      params: {
        username: config.username,
        password: config.password,
      },
      timeout: 10000,
    });

    if (response.data === false) {
      throw new Error('Login failed - invalid credentials');
    }

    // pyLoad returns session cookie
    const cookies = response.headers['set-cookie'];
    if (cookies && cookies.length > 0) {
      const sessionMatch = cookies[0].match(/session=([^;]+)/);
      if (sessionMatch) {
        this.session = sessionMatch[1];
        return this.session;
      }
    }

    // Some versions return session in response
    if (typeof response.data === 'string' && response.data.length > 0) {
      this.session = response.data;
      return this.session;
    }

    throw new Error('Login succeeded but no session received');
  }

  private async apiCall(endpoint: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.session) {
      await this.login();
    }

    const url = `${this.getBaseUrl()}/api/${endpoint}`;

    try {
      const response = await axios.post(url, null, {
        params,
        headers: {
          Cookie: `session=${this.session}`,
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      // Session expired, try to re-login
      if (error.response?.status === 403 || error.response?.status === 401) {
        this.session = null;
        await this.login();
        const response = await axios.post(url, null, {
          params,
          headers: {
            Cookie: `session=${this.session}`,
          },
          timeout: 10000,
        });
        return response.data;
      }
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    const config = getConfig().pyload;
    console.log('[pyLoad] Testing connection...');
    console.log(`[pyLoad] Config: host=${config.host}, port=${config.port}, username=${config.username}`);

    if (!config.host) {
      console.log('[pyLoad] Missing required field: host');
      return false;
    }

    try {
      console.log(`[pyLoad] Connecting to ${this.getBaseUrl()}`);
      await this.login();
      const status = await this.apiCall('statusServer');
      console.log('[pyLoad] Server status:', JSON.stringify(status));
      return true;
    } catch (error: any) {
      console.error('[pyLoad] Connection test failed:', error.message || error);
      return false;
    }
  }

  async addDownload(url: string, filename?: string): Promise<boolean> {
    if (!this.isEnabled()) {
      console.warn('[pyLoad] Not enabled');
      return false;
    }

    try {
      // pyLoad's addPackage API: name, links
      const packageName = filename || `Download-${Date.now()}`;

      const result = await this.apiCall('addPackage', {
        name: packageName,
        links: JSON.stringify([url]),
      });

      console.log(`[pyLoad] Added package "${packageName}" with result: ${result}`);
      return true;
    } catch (error: any) {
      console.error('[pyLoad] Error adding download:', error.message || error);
      return false;
    }
  }
}
