// TODO: Configurar variables de entorno en Netlify
// SUPA_URL=tu_supabase_url
// SUPA_KEY=tu_supabase_anon_key
// BREVO_KEY=tu_brevo_api_key
// TEMPLATE_ID=tu_template_id_brevo

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPA_URL;
const supabaseKey = process.env.SUPA_KEY;
const brevoKey = process.env.BREVO_KEY;
const templateId = process.env.TEMPLATE_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const { rating, email, loc } = JSON.parse(event.body);

        // Validar datos
        if (!rating || !email || !loc) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Datos incompletos' })
            };
        }

        if (rating < 1 || rating > 5) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Puntuación inválida' })
            };
        }

        // Verificar si ya existe el feedback
        const { data: existingFeedback, error: checkError } = await supabase
            .from('feedback')
            .select('id')
            .eq('email', email)
            .eq('loc', loc)
            .single();

        let firstTime = !existingFeedback;

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking existing feedback:', checkError);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Error interno del servidor' })
            };
        }

        // Insertar o actualizar feedback
        const { data, error } = await supabase
            .from('feedback')
            .upsert({
                email,
                loc,
                rating,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email,loc'
            });

        if (error) {
            console.error('Error inserting feedback:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Error al guardar feedback' })
            };
        }

        // Enviar cupón por email solo si es primera vez
        if (firstTime && brevoKey && templateId) {
            try {
                const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': brevoKey
                    },
                    body: JSON.stringify({
                        templateId: parseInt(templateId),
                        to: [{ email }],
                        params: {
                            RATING: rating,
                            LOCATION: loc
                        },
                        scheduledAt: new Date(Date.now() + 60000).toISOString() // +60 segundos
                    })
                });

                if (!brevoResponse.ok) {
                    console.error('Error enviando email:', await brevoResponse.text());
                }
            } catch (emailError) {
                console.error('Error con Brevo:', emailError);
                // No fallar la request por error de email
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                firstTime
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno del servidor' })
        };
    }
};
