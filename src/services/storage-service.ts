import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const bucketName = 'animini-videos';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class StorageService {
  /**
   * Generates a structured signed URL for direct file upload.
   * Path format: authors/{userId}/series/{seriesId}/{timestamp}.extension
   */
  public async createUploadUrl(
    userId: number,
    seriesId: string,
    fileName: string
  ) {
    const fileExtension = fileName.split('.').pop();
    const timestamp = Date.now();

    // Constructing the path with slashes creates virtual folders in Supabase Storage
    const filePath = `authors/${userId}/series/${seriesId}/${timestamp}.${fileExtension}`;

    // Fix: The second argument is for options like 'upsert'.
    // The expiry time is now managed differently or uses default (usually 15-60 mins).
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw new Error(`Failed to create upload URL: ${error.message}`);
    }

    return {
      uploadUrl: data.signedUrl,
      fileKey: filePath,
    };
  }
}

export const storageService = new StorageService();
