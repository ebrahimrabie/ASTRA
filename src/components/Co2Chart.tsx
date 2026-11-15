import { useI18n } from '../i18n';
import type { EnvSampleItem } from '../types';

function formatUtcTime(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function Co2Chart({ samples }: { samples: EnvSampleItem[] }) {
  const { t } = useI18n();
  const width = 720;
  const height = 230;
  const padLeft = 52;
  const padRight = 28;
  const padTop = 32;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const vals = samples.map((s) => s.value);
  const minVal = Math.min(2.4, ...(vals.length ? vals : [2.4])) - 0.1;
  const maxVal = Math.max(3.6, ...(vals.length ? vals : [3.6])) + 0.1;
  const midTick = Number(((minVal + maxVal) / 2).toFixed(1));
  const yTicks = [Number(minVal.toFixed(1)), 3.0, midTick, Number(maxVal.toFixed(1))].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  const valueToY = (val: number) =>
    padTop + chartH - ((val - minVal) / (maxVal - minVal || 1)) * chartH;

  const points = samples.map((sample, idx) => {
    const x =
      samples.length <= 1
        ? padLeft + chartW / 2
        : padLeft + (idx / (samples.length - 1)) * chartW;
    const y = valueToY(sample.value);
    return { sample, x, y, timeLabel: formatUtcTime(sample.sampledAt) };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const refY = valueToY(3.0);
  const summary = points
    .map((p) => `${p.timeLabel} ${p.sample.value} mmHg`)
    .join(', ');

  return (
    <div className="chart-container" dir="ltr">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('charts.co2Aria', { summary })}
      >
        {yTicks.map((tick) => {
          const y = valueToY(tick);
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
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* 3 mmHg reference line */}
        <line
          x1={padLeft}
          y1={refY}
          x2={width - padRight}
          y2={refY}
          stroke="var(--warning)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text
          x={width - padRight - 4}
          y={refY + 18}
          textAnchor="end"
          fill="var(--warning)"
          fontSize="12"
          fontWeight="600"
        >
          {t('charts.co2RefLine')}
        </text>

        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="2.5"
            points={polylinePoints}
          />
        )}

        {points.map((p) => (
          <g key={p.sample.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill="var(--cyan)"
              stroke="var(--bg)"
              strokeWidth="1.5"
            />
            <text
              x={p.x}
              y={p.y - 11}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="12"
              fontWeight="600"
            >
              {p.sample.value.toFixed(1)}
            </text>
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fill="var(--text2)"
              fontSize="12"
            >
              {p.timeLabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
