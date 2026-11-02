export const useRouter = () => ({
  push: (u: string) => ((window as any).__nav = [...((window as any).__nav ?? []), ["push", u]]),
  refresh: () => ((window as any).__nav = [...((window as any).__nav ?? []), ["refresh"]]),
});
export const usePathname = () => "/schedule/s1/2570-01";
