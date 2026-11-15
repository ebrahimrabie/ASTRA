import { useI18n } from '../i18n';
import type { SleepRecordItem } from '../types';

export function SleepChart({ records }: { records: SleepRecordItem[] }) {
  const { t } = useI18n();
  const width = 720;
  const height = 240;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 28;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxHours = 10;
  const gridTicks = [0, 2.5, 5, 7.5, 10];
  const slotW = chartW / Math.max(records.length, 1);
  const barW = Math.min(54, slotW * 0.52);

  const yForHours = (h: number) => padTop + chartH - (h / maxHours) * chartH;
  const y7 = yForHours(7.0);
  const y85 = yForHours(8.5);

  const hoursWord = t('charts.hoursWord');
  const summary = records.map((r) => `${r.day}: ${r.hours} ${hoursWord}`).join(', ');

  return (
    <div className="chart-container" dir="ltr">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('charts.sleepAria', { summary })}
      >
        {gridTicks.map((tick) => {
          const y = yForHours(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="var(--text2)"
                fontSize="11"
              >
                {tick}h
              </text>
            </g>
          );
        })}

        {/* 8.5 h NASA scheduled sleep period line */}
        <line
          x1={padLeft}
          y1={y85}
          x2={width - padRight}
          y2={y85}
          stroke="var(--purple)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text
          x={width - padRight - 4}
          y={y85 - 5}
          textAnchor="end"
          fill="var(--purple)"
          fontSize="11"
          fontWeight="600"
        >
          {t('charts.sleepRefNasa')}
        </text>

        {/* 7.0 h clinical reference line */}
        <line
          x1={padLeft}
          y1={y7}
          x2={width - padRight}
          y2={y7}
          stroke="var(--warning)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <text
          x={width - padRight - 4}
          y={y7 + 13}
          textAnchor="end"
          fill="var(--warning)"
          fontSize="11"
          fontWeight="600"
        >
          {t('charts.sleepRefClinical')}
        </text>

        {records.map((rec, idx) => {
          const barH = Math.max(0, Math.min(chartH, (rec.hours / maxHours) * chartH));
          const x = padLeft + idx * slotW + (slotW - barW) / 2;
          const y = padTop + chartH - barH;
          const isShort = rec.hours < 7.0;
          return (
            <g key={`${rec.day}-${idx}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={6}
                ry={6}
                fill={isShort ? 'var(--warning)' : 'var(--cyan)'}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fill="var(--text)"
                fontSize="12"
                fontWeight="600"
              >
                {rec.hours}
              </text>
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                fill="var(--text2)"
                fontSize="12"
              >
                {rec.day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
