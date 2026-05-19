import { apiClient } from "@/services/api"
import type {
  ApiFinalRatingConfig,
  FinalRatingConfigData,
  FinalRatingConfigsListBody,
  FinalRatingDefaultStructureBody,
  CreateFinalRatingConfigPayload,
  UpdateFinalRatingConfigPayload,
  CalculateFinalRatingsPayload,
  FinalRatingsCalculateResult,
  FinalRatingsExportFormat,
} from "../types"

// ─── Service ──────────────────────────────────────────────────────────────────
// Thin wrapper around apiClient for all /final-ratings/configs endpoints.
// Each method maps 1-to-1 with a backend route.

class FinalRatingConfigService {
  /**
   * GET /final-ratings/configs
   * List all final rating configs (no pagination, returns array).
   * Backend returns { success, data: [...] }
   */
  async getAll(): Promise<ApiFinalRatingConfig[]> {
    // Cast to the list body shape since it's not a standard paginated response
    const raw = (await apiClient.get<unknown>(
      "/final-ratings/configs",
    )) as unknown as FinalRatingConfigsListBody
    return raw.data
  }

  /**
   * GET /final-ratings/configs/active
   * Fetch the currently active final rating config.
   * Returns 404 if no active config exists.
   */
  async getActive(): Promise<ApiFinalRatingConfig> {
    // Some backend builds do not expose /configs/active reliably.
    // Read all configs and derive the active one client-side.
    const configs = await this.getAll()
    const active = configs.find((config) => config.is_active)

    if (!active) {
      throw new Error("No active configuration found")
    }

    return active
  }

  /**
   * GET /final-ratings/configs/default-structure
   * Fetch the default config data structure (used to pre-fill create form).
   * Returns { success, data: FinalRatingConfigData }
   */
  async getDefaultStructure(): Promise<FinalRatingConfigData> {
    const raw = (await apiClient.get<unknown>(
      "/final-ratings/configs/default-structure",
    )) as unknown as FinalRatingDefaultStructureBody
    return raw.data
  }

  /**
   * GET /final-ratings/configs/{id}
   * Fetch a single final rating config by its numeric ID.
   */
  async getById(id: number): Promise<ApiFinalRatingConfig> {
    const response = await apiClient.get<ApiFinalRatingConfig>(`/final-ratings/configs/${id}`)
    return response.data
  }

  /**
   * POST /final-ratings/configs
   * Create a new final rating config.
   * Returns the created ApiFinalRatingConfig (201 response).
   */
  async create(payload: CreateFinalRatingConfigPayload): Promise<ApiFinalRatingConfig> {
    const response = await apiClient.post<ApiFinalRatingConfig>("/final-ratings/configs", payload)
    return response.data
  }

  /**
   * PUT /final-ratings/configs/{id}
   * Update an existing final rating config by ID.
   * Returns the updated ApiFinalRatingConfig (200 response).
   */
  async update(id: number, payload: UpdateFinalRatingConfigPayload): Promise<ApiFinalRatingConfig> {
    const response = await apiClient.put<ApiFinalRatingConfig>(
      `/final-ratings/configs/${id}`,
      payload,
    )
    return response.data
  }

  /**
   * POST /final-ratings/configs/{id}/activate
   * Activate a final rating config by its ID.
   * The backend deactivates any previously active config.
   * Returns the updated ApiFinalRatingConfig (200 response).
   */
  async activate(id: number): Promise<ApiFinalRatingConfig> {
    const response = await apiClient.post<ApiFinalRatingConfig>(
      `/final-ratings/configs/${id}/activate`,
      {},
    )
    return response.data
  }

  /**
   * DELETE /final-ratings/configs/{id}
   * Permanently delete a final rating config.
   * Cannot delete the active config (backend returns 400).
   */
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/final-ratings/configs/${id}`)
  }

  /**
   * POST /final-ratings/calculate
   * Run the final rating calculation for a given period.
   * Returns FinalRatingsCalculateResult with a ranked users array.
   */
  async calculate(payload: CalculateFinalRatingsPayload): Promise<FinalRatingsCalculateResult> {
    const raw = (await apiClient.post<unknown>(
      "/final-ratings/calculate",
      payload,
    )) as unknown as { success: boolean; data: FinalRatingsCalculateResult }
    return raw.data
  }

  /**
   * POST /final-ratings/export-pdf
   * Generate PDFs for all users and download them as a ZIP archive.
   * Uses apiClient.downloadFilePost() which handles the blob + content-disposition header.
   */
  async exportPdf(
    payload: CalculateFinalRatingsPayload,
    format: FinalRatingsExportFormat = "zip",
  ): Promise<void> {
    await apiClient.downloadFilePost("/final-ratings/export-pdf", {
      ...payload,
      format,
    })
  }
}

// Export a singleton so the store and hooks share the same instance
export const finalRatingConfigService = new FinalRatingConfigService()
