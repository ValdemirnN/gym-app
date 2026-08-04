import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

function monthRangeLabel() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const label = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return { start, label };
}

export async function generateAndShareMonthlyReport(studentId, studentName) {
  const { start } = monthRangeLabel();
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const [{ data: logs }, { data: workouts }, { data: evaluations }] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('started_at, finished_at, skipped, workouts(name)')
      .eq('user_id', studentId)
      .gte('started_at', start.toISOString())
      .order('started_at'),
    supabase.from('workouts').select('id').eq('user_id', studentId),
    supabase
      .from('evaluations')
      .select('*')
      .eq('student_id', studentId)
      .order('evaluation_date'),
  ]);

  const done = (logs || []).filter((l) => l.finished_at && !l.skipped);
  const skipped = (logs || []).filter((l) => l.skipped);
  const metaSemanal = (workouts || []).length;
  const semanasNoMes = 4.3;
  const metaMes = Math.round(metaSemanal * semanasNoMes);
  const percentual = metaMes > 0 ? Math.min(Math.round((done.length / metaMes) * 100), 100) : 0;

  const evalsThisMonth = (evaluations || []).filter((e) => new Date(e.evaluation_date) >= start);
  const firstEval = evaluations?.[0];
  const lastEval = evaluations?.[evaluations.length - 1];

  const weightChange =
    firstEval?.weight_kg && lastEval?.weight_kg ? (lastEval.weight_kg - firstEval.weight_kg).toFixed(1) : null;

  const logsRows = (logs || [])
    .map(
      (l) => `
      <tr>
        <td>${new Date(l.started_at).toLocaleDateString('pt-BR')}</td>
        <td>${l.workouts?.name || '-'}</td>
        <td style="color:${l.skipped ? '#e5484d' : l.finished_at ? '#0cae5f' : '#b98900'}">
          ${l.skipped ? 'Não treinou' : l.finished_at ? 'Concluído' : 'Em andamento'}
        </td>
      </tr>`
    )
    .join('');

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; padding: 24px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .sub { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
        .stats { display: flex; gap: 12px; margin-bottom: 24px; }
        .stat { flex: 1; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
        .stat .label { color: #6b7280; font-size: 11px; text-transform: uppercase; }
        .stat .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
        h2 { font-size: 15px; margin-top: 28px; border-bottom: 2px solid #10b981; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
        th { text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; padding: 6px 8px; }
        td { padding: 8px; border-top: 1px solid #f1f5f9; }
        .footer { margin-top: 40px; color: #9ca3af; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <h1>Relatório mensal — ${studentName || 'Aluno'}</h1>
      <div class="sub">Referente a ${monthLabel}</div>

      <div class="stats">
        <div class="stat"><div class="label">Consistência</div><div class="value">${percentual}%</div></div>
        <div class="stat"><div class="label">Treinos concluídos</div><div class="value">${done.length}</div></div>
        <div class="stat"><div class="label">Não treinou</div><div class="value">${skipped.length}</div></div>
      </div>

      ${
        weightChange !== null
          ? `<h2>Evolução de peso</h2>
             <p style="font-size:13px">Desde o início do acompanhamento: <b>${firstEval.weight_kg} kg → ${lastEval.weight_kg} kg</b>
             (${weightChange > 0 ? '+' : ''}${weightChange} kg)</p>`
          : ''
      }

      ${
        evalsThisMonth.length > 0
          ? `<h2>Avaliações registradas no mês</h2>
             <table>
               <tr><th>Data</th><th>Peso</th><th>% Gordura</th></tr>
               ${evalsThisMonth
                 .map(
                   (e) =>
                     `<tr><td>${new Date(e.evaluation_date).toLocaleDateString('pt-BR')}</td><td>${
                       e.weight_kg ? e.weight_kg + ' kg' : '-'
                     }</td><td>${e.body_fat_pct ? e.body_fat_pct + '%' : '-'}</td></tr>`
                 )
                 .join('')}
             </table>`
          : ''
      }

      <h2>Treinos do mês</h2>
      <table>
        <tr><th>Data</th><th>Treino</th><th>Status</th></tr>
        ${logsRows || '<tr><td colspan="3">Nenhum treino registrado esse mês.</td></tr>'}
      </table>

      <div class="footer">Gerado automaticamente pelo app · ${new Date().toLocaleDateString('pt-BR')}</div>
    </body>
  </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Relatório - ${studentName}` });
  }
  return uri;
}
