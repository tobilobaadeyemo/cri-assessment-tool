import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { assessmentId } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: responses, error: fetchError } = await supabase
      .from('responses')
      .select('answers')
      .eq('assessment_id', assessmentId)
      .eq('is_complete', true)

    if (fetchError) throw fetchError
    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: 'No complete responses found' }), { status: 400 })
    }

    let totalScore = 0
    for (const resp of responses) {
      const answers = resp.answers
      const numericAnswers = Object.values(answers).filter(v => typeof v === 'number')
      if (numericAnswers.length === 0) continue
      const avg = numericAnswers.reduce((a,b) => a + b, 0) / numericAnswers.length
      totalScore += avg
    }
    const overallScore = (totalScore / responses.length) * 20
    const colourBand = overallScore >= 70 ? 'green' : overallScore >= 40 ? 'amber' : 'red'

    const { error: updateError } = await supabase
      .from('assessments')
      .update({ overall_score: overallScore, colour_band: colourBand })
      .eq('id', assessmentId)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, overallScore }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
