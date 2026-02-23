import { useMemo } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

interface ScatterChartProps {
  data: Record<string, unknown>[];
  xField: string;
  yField: string;
  sizeField?: string;
  colorField?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  renderer?: "canvas" | "svg";
}

const MIN_SYMBOL = 5;
const MAX_SYMBOL = 40;
const DEFAULT_SYMBOL = 20;

function ScatterChart({
  data,
  xField,
  yField,
  sizeField,
  colorField,
  title,
  className,
  style,
  loading,
  renderer,
}: ScatterChartProps) {
  const option = useMemo<EChartsOption>(() => {
    let sizeMin = 0;
    let sizeRange = 0;

    if (sizeField) {
      const sizes = data.map((d) => Number(d[sizeField]) || 0);
      if (sizes.length > 0) {
        sizeMin = Math.min(...sizes);
        const sizeMax = Math.max(...sizes);
        sizeRange = sizeMax - sizeMin;
      }
    }

    const normalizeSize = (raw: number) =>
      sizeRange === 0
        ? DEFAULT_SYMBOL
        : MIN_SYMBOL + ((raw - sizeMin) / sizeRange) * (MAX_SYMBOL - MIN_SYMBOL);

    const buildPoints = (items: Record<string, unknown>[]) =>
      items.map((d) => {
        const point: { value: number[]; symbolSize?: number } = {
          value: [Number(d[xField]) || 0, Number(d[yField]) || 0],
        };
        if (sizeField) {
          const raw = Number(d[sizeField]) || 0;
          point.value.push(raw);
          point.symbolSize = normalizeSize(raw);
        }
        return point;
      });

    const formatter = (params: unknown) => {
      const p = params as { value: number[]; seriesName?: string };
      const lines: string[] = [];
      if (colorField && p.seriesName) {
        lines.push(`${colorField}: <b>${p.seriesName}</b>`);
      }
      lines.push(`${xField}: <b>${p.value[0]}</b>`);
      lines.push(`${yField}: <b>${p.value[1]}</b>`);
      if (sizeField && p.value.length > 2) {
        lines.push(`${sizeField}: <b>${p.value[2]}</b>`);
      }
      return lines.join("<br/>");
    };

    if (colorField) {
      const groups = new Map<string, Record<string, unknown>[]>();
      data.forEach((d) => {
        const key = String(d[colorField] ?? "");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(d);
      });

      const seriesData = Array.from(groups.entries()).map(([name, items]) => ({
        name,
        type: "scatter" as const,
        data: buildPoints(items),
      }));

      return {
        title: title ? { text: title } : undefined,
        tooltip: { trigger: "item" as const, formatter },
        legend: { data: Array.from(groups.keys()) },
        xAxis: { type: "value" as const },
        yAxis: { type: "value" as const },
        series: seriesData,
      };
    }

    return {
      title: title ? { text: title } : undefined,
      tooltip: { trigger: "item" as const, formatter },
      xAxis: { type: "value" as const },
      yAxis: { type: "value" as const },
      series: [{ type: "scatter" as const, data: buildPoints(data) }],
    };
  }, [data, xField, yField, sizeField, colorField, title]);

  return (
    <EChart
      option={option}
      className={className}
      style={style}
      loading={loading}
      renderer={renderer}
    />
  );
}

export type { ScatterChartProps };
export default ScatterChart;
