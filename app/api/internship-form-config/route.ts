import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Form config ve alanlarını getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formName = searchParams.get('form_name') || 'myuni_internship';
    const configId = searchParams.get('id');

    let configQuery = supabaseAdmin.from('internship_form_configs').select('id, form_name, title, subtitle, submit_button_text, success_message, privacy_notice, terms_and_conditions, is_active, created_at, updated_at').eq('is_active', true);

    if (configId) {
      configQuery = configQuery.eq('id', configId);
    } else {
      configQuery = configQuery.eq('form_name', formName);
    }

    const { data: config, error: configError } = await configQuery.single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Form yapılandırması bulunamadı' },
        { status: 404 }
      );
    }

    // Form alanlarını getir
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('internship_form_fields')
      .select('id, form_config_id, field_key, field_type, label, placeholder, is_required, validation_rules, options, sort_order, grid_columns, is_active, created_at, updated_at')
      .eq('form_config_id', config.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (fieldsError) {
      console.error('Fetch fields error:', fieldsError);
      return NextResponse.json(
        { error: 'Form alanları getirilemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
      fields: fields || []
    });

  } catch (error) {
    console.error('Form config GET error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Form config güncelle
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID gerekli' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('internship_form_configs')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId)
      .select('id, form_name, title, subtitle, submit_button_text, success_message, privacy_notice, terms_and_conditions, is_active, created_at, updated_at')
      .single();

    if (error) {
      console.error('Update config error:', error);
      return NextResponse.json(
        { error: 'Form yapılandırması güncellenemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Form yapılandırması güncellendi',
      config: data
    });

  } catch (error) {
    console.error('Form config PATCH error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
