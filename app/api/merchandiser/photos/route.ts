import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Get current user from session cookie
async function getCurrentUser(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch (e) {
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

    // Upload each photo to Supabase Storage
    for (let i = 0; i < photo_data_urls.length; i++) {
      const dataUrl = photo_data_urls[i];
      
      try {
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Generate unique filename
        const filename = `merchandiser/${visit_id}/${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.jpg`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('merchandiser-photos')
          .upload(filename, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          console.error('[API merchandiser/photos] Upload error:', uploadError);
          continue; // Skip this photo but continue with others
        }

        // Get public URL
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('merchandiser-photos')
          .getPublicUrl(filename);

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      } catch (photoError) {
        console.error('[API merchandiser/photos] Error processing photo:', photoError);
        // Continue with next photo
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'Failed to upload any photos' }, { status: 500 });
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
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API merchandiser/photos POST] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
