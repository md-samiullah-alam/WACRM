// recharts v3.8.x does not ship its types/ directory despite declaring
// "types": "types/index.d.ts" in package.json. Provide a minimal module
// declaration so TypeScript can resolve imports from "recharts".
declare module "recharts" {
  export const Bar: any;
  export const CartesianGrid: any;
  export const Label: any;
  export const BarChart: any;
  export const Legend: any;
  export const ResponsiveContainer: any;
  export const Tooltip: any;
  export const XAxis: any;
  export const YAxis: any;
}