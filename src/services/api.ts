import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  isCancel,
} from "axios";
import { toast } from "sonner";
import type { ApiResponse, PaginatedData } from "@/types";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
      
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.setupInterceptors();
  }

  private getFilenameFromDisposition(disposition?: string): string | null {
    if (!disposition) return null;

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1].replace(/[\"]/g, "").trim());
    }

    const asciiMatch = disposition.match(/filename=(?:"([^"]+)"|([^;]+))/i);
    const raw = asciiMatch?.[1] ?? asciiMatch?.[2];
    return raw ? raw.replace(/[\"]/g, "").trim() : null;
  }

  private inferExtensionFromContentType(contentType?: string): string | null {
    if (!contentType) return null;

    const mime = contentType.split(";")[0].trim().toLowerCase();
    if (mime === "application/zip") return "zip";
    if (mime === "application/pdf") return "pdf";
    if (mime === "application/json") return "json";
    if (mime === "text/plain") return "txt";
    return null;
  }

  private async inferExtensionFromBlob(blob: Blob): Promise<string | null> {
    const header = await blob.slice(0, 4).arrayBuffer();
    const bytes = Array.from(new Uint8Array(header));

    // ZIP magic: PK\x03\x04 (or other PK variants)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
    // PDF magic: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";

    return null;
  }

  private async resolveDownloadFilename(url: string, response: AxiosResponse<Blob>): Promise<string> {
    const disposition = response.headers["content-disposition"] as string | undefined;
    const fromDisposition = this.getFilenameFromDisposition(disposition);
    if (fromDisposition) return fromDisposition;

    const blob = new Blob([response.data], {
      type: (response.headers["content-type"] as string | undefined) ?? response.data.type,
    });

    const extFromContentType = this.inferExtensionFromContentType(response.headers["content-type"] as string | undefined);
    const extFromMagic = await this.inferExtensionFromBlob(blob);
    const ext = extFromMagic ?? extFromContentType;

    const urlTail = url.split("/").pop() ?? "download";
    const baseName = urlTail.replace(/\?.*$/, "") || "download";
    const hasExtension = /\.[a-z0-9]+$/i.test(baseName);

    if (hasExtension) return baseName;
    return ext ? `${baseName}.${ext}` : `${baseName}.bin`;
  }

  // ─── Interceptors ──────────────────────────────────────────────

  /**
   * Turns an Axios error into a message that's safe and useful to show a user.
   * Field-level validation messages (422) are already user-facing copy written
   * by the backend, so those pass through as-is. Framework-level failures
   * (405, 500, network drops, etc.) surface raw technical text like
   * "The POST method is not supported for route api/users/15" — those get
   * replaced with plain-language copy instead.
   */
  private getToastErrorMessage(error: unknown): string {
    const axiosError = error as {
      response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
    };
    const status = axiosError?.response?.status;
    const data = axiosError?.response?.data;

    // Field-level validation errors — show the first specific message
    const firstFieldError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    if (firstFieldError) return String(firstFieldError);

    // No response at all — network/timeout failure
    if (!axiosError?.response) {
      return "Network error. Please check your connection and try again.";
    }

    switch (status) {
      case 401:
        return "Your session has expired. Please log in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return data?.message || "The requested item could not be found.";
      case 419:
        return "Your session has expired. Please refresh the page and try again.";
      case 405:
      case 500:
      case 502:
      case 503:
        return "Something went wrong on our end. Please try again in a moment.";
      default:
        return data?.message || "Something went wrong. Please try again.";
    }
  }

  // Allow callers to pass `toast` messages through config: { toast: { success, error } }
  private setupInterceptors(): void {
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - axios headers typing is loose here
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        try {
          const cfg = response.config as AxiosRequestConfig & { toast?: { success?: string } };
          if (cfg?.toast?.success) {
            toast.success(cfg.toast.success);
          }
        } catch (err) {
          // swallow
        }

        return response;
      },
      (error) => {
        if (isCancel(error)) return Promise.reject(error);

        try {
          const cfg = error?.config as AxiosRequestConfig & { toast?: { error?: string } } | undefined;

          // Per-request override takes priority, otherwise derive a friendly message
          const toastMessage = cfg?.toast?.error ?? this.getToastErrorMessage(error);
          if (toastMessage) toast.error(String(toastMessage));
        } catch (err) {
          // swallow
        }

        if (error.response?.status === 401 && !error.config?.url?.includes("/login")) {
          localStorage.removeItem("auth_token");
          window.location.href = "/login";
        }

        return Promise.reject(error);
      },
    );
  }

  // ─── Public Methods ────────────────────────────────────────────

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async getPaginated<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<PaginatedData<T>>> {
    const response = await this.client.get<ApiResponse<PaginatedData<T>>>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  async postMultipart<T>(url: string, data: FormData, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, {
      ...config,
      headers: {
        ...config?.headers,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  async downloadFile(url: string, config?: AxiosRequestConfig): Promise<void> {
    const response: AxiosResponse<Blob> = await this.client.get(url, {
      ...config,
      responseType: "blob",
    });

    const filename = await this.resolveDownloadFilename(url, response);
    const blob = new Blob([response.data], {
      type: (response.headers["content-type"] as string | undefined) ?? response.data.type,
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  /**
   * POST to a URL and trigger a file download from the response blob.
   * Used for endpoints that generate and return binary files (e.g. ZIP exports).
   */
  async downloadFilePost(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<void> {
    const response: AxiosResponse<Blob> = await this.client.post(url, data, {
      ...config,
      responseType: "blob",
    });

    const filename = await this.resolveDownloadFilename(url, response);
    const blob = new Blob([response.data], {
      type: (response.headers["content-type"] as string | undefined) ?? response.data.type,
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }
}

export const apiClient = new ApiClient();
