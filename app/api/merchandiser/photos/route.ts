import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1] || 'image/jpeg';
  const base64 = match[2];

  try {
    return {
      buffer: Buffer.from(base64, 'base64'),
      mimeType,
    };
  } catch {
    return null;
  }
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

// Get current user from session cookie
async function getCurrentUser(request: NextRequest) {
  try {
    const session = request.cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch {
    return null;
  }
}

// POST - Upload photos for a visit
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Merchandiser, Sales, and Admin can upload photos
    if (currentUser.role !== 'Merchandiser' && currentUser.role !== 'Sales' && currentUser.role !== 'Admin' && currentUser.role !== 'Main Admin') {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    const { visit_id, photo_data_urls } = body;

    if (!visit_id) {
      return NextResponse.json({ error: 'visit_id is required' }, { status: 400 });
    }

    if (!photo_data_urls || !Array.isArray(photo_data_urls) || photo_data_urls.length === 0) {
      return NextResponse.json({ error: 'photo_data_urls array is required' }, { status: 400 });
    }

    // Verify the visit exists and belongs to the user
    const { data: visit } = await supabaseAdmin
      .from('store_visits')
      .select('merchandiser_id, branch, photo_urls')
      .eq('id', visit_id)
      .single();

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Permission check
    if (currentUser.role === 'Merchandiser' || currentUser.role === 'Sales') {
      if (visit.merchandiser_id !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden - you can only upload photos to your own visits' }, { status: 403 });
      }
    } else if (currentUser.role === 'Admin') {
      if (visit.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // Main Admin can upload to any visit

    const uploadedUrls: string[] = [];
    const failedUploads: Array<{ index: number; reason: string }> = [];

    // Upload each photo to Supabase Storage
    for (let i = 0; i < photo_data_urls.length; i++) {
      const dataUrl = photo_data_urls[i];
      
      try {
        const decoded = decodeDataUrl(dataUrl);
        if (!decoded) {
          failedUploads.push({ index: i, reason: 'Invalid photo format (not a base64 data URL)' });
          continue;
        }

        const { buffer, mimeType } = decoded;
        const extension = extensionFromMimeType(mimeType);
        
        // Generate unique filename
        const filename = `merchandiser/${visit_id}/${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${extension}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('merchandiser-photos')
          .upload(filename, buffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: mimeType,
          });

        if (uploadError) {
          console.error('[API merchandiser/photos] Upload error:', uploadError);
          failedUploads.push({ index: i, reason: uploadError.message || 'Storage upload failed' });
          continue; // Skip this photo but continue with others
        }

        // Get public URL
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('merchandiser-photos')
          .getPublicUrl(filename);

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        } else {
          failedUploads.push({ index: i, reason: 'Failed to generate public URL' });
        }
      } catch (photoError) {
        console.error('[API merchandiser/photos] Error processing photo:', photoError);
        failedUploads.push({ index: i, reason: photoError instanceof Error ? photoError.message : 'Unexpected photo processing error' });
        // Continue with next photo
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any photos', details: failedUploads }, { status: 500 });
    }

    // Merge with existing photo URLs
    const existingUrls = visit.photo_urls || [];
    const allUrls = [...existingUrls, ...uploadedUrls];

    // Update visit with new photo URLs
    const { error: updateError } = await supabaseAdmin
      .from('store_visits')
      .update({ photo_urls: allUrls })
      .eq('id', visit_id);

    if (updateError) {
      console.error('[API merchandiser/photos] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update visit with photo URLs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      uploaded_count: uploadedUrls.length,
      urls: uploadedUrls,
      total_photos: allUrls.length,
      failed_uploads: failedUploads,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API merchandiser/photos POST] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
