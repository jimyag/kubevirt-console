import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Navigate } from "react-router-dom";
import {
  Cpu, Terminal, ChevronLeft, FileCode, Info, Network, HardDrive,
  Layers, ShieldCheck, Server, Database, Hash, Bell, Clock, TrendingUp, BarChart3,
  Search, Box, Filter, Check, Copy, MousePointer2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

import { VncConsole } from "./components/VncConsole";
import { SerialConsole } from "./components/SerialConsole";
import { AppSidebar } from "./components/app-sidebar";
import { RelatedPodsCard } from "./components/pod-access";
import { ResourceCreateDialog, ResourceDetail, ResourceList, ResourceManifest, type ResourceConfig } from "./components/resource-management";
import { SiteHeader } from "./components/site-header";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card as ShadCard, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { dvCreateConfig, jsonPost, jsonPut, keyValueText, mergePatch, numberValue, parseKeyValueText, resourceConfigs, stringValue, vmCreateConfig } from "./resources/configs";
import { KubernetesCategoryPage, KubernetesManagementPage, KubeVirtCategoryPage, KubeVirtManagementPage, NetworkCategoryPage, NetworkManagementPage, StorageCategoryPage, StorageManagementPage } from "./resources/group-pages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";

interface ResourceMetadata { name: string; namespace: string; uid: string; creationTimestamp: string; labels?: Record<string, string>; annotations?: Record<string, string>; }
interface VM { metadata: ResourceMetadata; spec: { running?: boolean; runStrategy?: string; template?: { metadata?: { labels?: Record<string, string>; annotations?: Record<string, string>; }; spec?: { architecture?: string; domain?: { machine?: { type?: string }; cpu?: { cores?: number, sockets?: number, threads?: number }; resources?: { requests?: { cpu?: string, memory?: string } }; devices?: { interfaces?: Array<{ name: string, model?: string }> }; }; networks?: Array<{ name: string, pod?: any }>; volumes?: Array<{ name: string, dataVolume?: { name: string } }>; }; }; }; status?: { printableStatus?: string; conditions?: Array<{ type: string; status: string; message?: string; reason?: string }>; }; }
interface VMI { metadata: ResourceMetadata; status: { phase: string; interfaces?: Array<{ ipAddress?: string; name: string }>; nodeName?: string }; }
interface DV { metadata: ResourceMetadata; status?: { phase: string; progress?: string; claimName?: string; conditions?: Array<{ type: string; status: string; message?: string; reason?: string }>; }; spec: { storage?: { resources?: { requests?: { storage?: string } } }; pvc?: { resources?: { requests?: { storage?: string } } }; source?: Record<string, any>; }; }
interface K8sNode { metadata: ResourceMetadata; status: { capacity: Record<string, string>; allocatable: Record<string, string>; conditions: Array<{ type: string; status: string }>; }; spec: { unschedulable?: boolean }; }
interface K8sPod { metadata: ResourceMetadata; status: { phase: string; containerStatuses?: Array<{ ready: boolean; restartCount: number }>; }; }
interface K8sEvent { metadata: ResourceMetadata; involvedObject: { kind: string; name: string; namespace: string; uid: string; }; reason: string; message: string; type: string; lastTimestamp: string; count: number; }
interface MetricPoint { time: string; timestamp: number; cpuUsage: number; memoryUsage: number; }

// --- Utils ---
const getContext = () => localStorage.getItem("kube-context") || "";
const apiFetch = (url: string, options: RequestInit = {}) => {
  const ctx = getContext(); const headers = new Headers(options.headers || {});
  if (ctx) headers.set("X-Kube-Context", ctx);
  return fetch(url, { ...options, headers });
};
const parseStorage = (s?: string): number => { if (!s) return 0; const num = parseFloat(s); if (s.endsWith("Ti")) return num * 1024; if (s.endsWith("Gi")) return num; if (s.endsWith("Mi")) return num / 1024; return num / (1024 * 1024); };
const formatStorage = (gi: number): string => gi >= 1024 ? `${(gi / 1024).toFixed(1)}Ti` : `${gi.toFixed(1)}Gi`;
const vmPodSelectors = (name: string): Array<Record<string, string>> => [
  { "vm.kubevirt.io/name": name },
  { "vmi.kubevirt.io/id": name },
  { "las.qiniu.io/vm-id": name },
  { "kubevirt.io/domain": name },
];
const findVmPod = async (namespace: string, name: string) => {
  for (const selector of vmPodSelectors(name)) {
    const labelSelector = Object.entries(selector).map(([key, value]) => `${key}=${value}`).join(",");
    const ps = await apiFetch(`/api/v1/namespaces/${namespace}/pods?labelSelector=${encodeURIComponent(labelSelector)}`);
    if (!ps.ok) continue;
    const pod = (await ps.json()).items?.[0];
    if (pod) return pod;
  }
  return null;
};

// --- Shared Components ---
type StatusVariant = "outline" | "success" | "warning" | "danger";
function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>;
  const lower = status.toLowerCase();
  let variant: StatusVariant = "outline";
  if (lower.includes("running") || lower.includes("succeeded") || lower.includes("ready") || lower.includes("true")) variant = "success";
  else if (lower.includes("error") || lower.includes("fail") || lower.includes("crash") || lower.includes("false")) variant = "danger";
  else if (lower.includes("start") || lower.includes("progress") || lower.includes("migrat") || lower.includes("import") || lower.includes("pending")) variant = "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function CopyableText({ text, label }: { text: string, label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="group relative flex flex-col gap-1 w-full bg-muted/30 p-2.5 rounded-lg border hover:border-border transition-all">
      {label && <div className="text-[9px] font-medium text-muted-foreground">{label}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] font-mono text-foreground break-all leading-relaxed flex-1">{text}</div>
        <button onClick={onCopy} className="p-1 hover:bg-background rounded-lg border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

type VmDialogField = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  defaultValue: string;
  options?: Array<{ label: string; value: string }>;
};

function VmActionDialog({
  label,
  description,
  fields,
  buildRequest,
  onDone,
  variant = "outline",
}: {
  label: string;
  description: string;
  fields: VmDialogField[];
  buildRequest: (values: Record<string, string>) => { url: string; options: RequestInit };
  onDone: () => void;
  variant?: "default" | "outline" | "destructive" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue])));
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const request = buildRequest(values);
      const res = await apiFetch(request.url, request.options);
      if (!res.ok) throw new Error(await res.text());
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {fields.map((field) => (
            <label key={field.name} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  value={values[field.name] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  className="min-h-28 rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : field.type === "select" ? (
                <select
                  value={values[field.name] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <Input
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.name] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={submit} disabled={saving}>{saving ? "Applying..." : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Views ---
function VMList() {
  const [vms, setVms] = useState<VM[]>([]); const [loading, setLoading] = useState(true); const [nss, setNss] = useState<string[]>(["all"]); const [availableS, setAvailableS] = useState<string[]>(["all"]); const [sT, setST] = useState(""); const [nF, setNF] = useState("all"); const [sF, setSF] = useState("all");
  const fetchVms = async () => { setLoading(true); try { const res = await apiFetch(`/api/v1/vms?name=${sT}&status=${sF}&namespace=${nF}`); const data = await res.json(); setVms(data.items || []); } finally { setLoading(false); } };
  const deleteVmRequest = (vm: VM) => ({
    url: `/apis/kubevirt.io/v1/namespaces/${vm.metadata.namespace}/virtualmachines/${vm.metadata.name}`,
    options: { method: "DELETE", headers: { Accept: "application/json" } },
  });
  useEffect(() => { apiFetch("/api/v1/namespaces-list").then(r => r.json()).then(setNss); apiFetch("/api/v1/vm-statuses").then(r => r.json()).then(setAvailableS); }, []);
  useEffect(() => { const timer = setTimeout(fetchVms, 300); return () => clearTimeout(timer); }, [sT, nF, sF]);
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Virtual Machines</h1>
          <p className="text-sm text-muted-foreground">Manage your virtual machine workloads</p>
        </div>
        <Badge variant="outline">{vms.length} total</Badge>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2 text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            Watch
          </Button>
          <Button size="sm" variant="outline" onClick={fetchVms} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-muted-foreground" />
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground min-w-[140px]" value={nF} onChange={e => setNF(e.target.value)}>
              {nss.map(ns => <option key={ns} value={ns}>{ns}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground min-w-[140px]" value={sF} onChange={e => setSF(e.target.value)}>
              {availableS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search VMs..." value={sT} onChange={e => setST(e.target.value)} />
          </div>
          <ResourceCreateDialog config={vmCreateConfig} onCreated={fetchVms} />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="max-h-[calc(100dvh-260px)] overflow-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-10"><input type="checkbox" className="size-4 rounded border-border accent-primary" aria-label="Select all VMs" /></TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Name</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Namespace</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Status</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs font-semibold">Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex items-center justify-center h-32 gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : vms.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No virtual machines found</TableCell></TableRow>
              ) : vms.map((vm) => (
                <TableRow key={vm.metadata.uid} className="hover:bg-muted/50">
                  <TableCell className="h-9 px-3 py-1.5"><input type="checkbox" className="size-4 rounded border-border accent-primary" aria-label={`Select ${vm.metadata.name}`} /></TableCell>
                  <TableCell className="h-9 px-3 py-1.5">
                    <Link to={`/kubevirt/virtualization/virtual-machines/${vm.metadata.namespace}/${vm.metadata.name}/overview`} className="font-semibold text-primary hover:underline">{vm.metadata.name}</Link>
                  </TableCell>
                  <TableCell className="h-9 px-3 py-1.5 text-muted-foreground text-sm">{vm.metadata.namespace}</TableCell>
                  <TableCell className="h-9 px-3 py-1.5"><StatusBadge status={vm.status?.printableStatus} /></TableCell>
                  <TableCell className="h-9 px-3 py-1.5 text-right text-muted-foreground text-sm tabular-nums">{vm.metadata.creationTimestamp || "N/A"}</TableCell>
                  <TableCell className="h-9 px-3 py-1.5 text-right">
                    <VmActionDialog
                      label="Delete"
                      description={`Delete VirtualMachine ${vm.metadata.namespace}/${vm.metadata.name}.`}
                      fields={[]}
                      variant="destructive"
                      buildRequest={() => deleteVmRequest(vm)}
                      onDone={fetchVms}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function DVList() {
  const [dvs, setDvs] = useState<DV[]>([]); const [loading, setLoading] = useState(true); const [searchTerm, setSearchTerm] = useState("");
  const loadDvs = async () => { setLoading(true); try { const data = await apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()); setDvs(data.items || []); } finally { setLoading(false); } };
  useEffect(() => { loadDvs(); }, []);
  const filtered = dvs.filter(dv => dv.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Storage</h1>
          <p className="text-sm text-muted-foreground">Manage your DataVolume storage resources</p>
        </div>
        <Badge variant="outline">{dvs.length} total</Badge>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2 text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            Watch
          </Button>
          <Button size="sm" variant="outline" onClick={loadDvs} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search storage..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <ResourceCreateDialog config={dvCreateConfig} onCreated={loadDvs} />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="max-h-[calc(100dvh-260px)] overflow-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-10"><input type="checkbox" className="size-4 rounded border-border accent-primary" aria-label="Select all storage resources" /></TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Name</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Status</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Capacity</TableHead>
                <TableHead className="h-9 px-3 text-right text-xs font-semibold">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex items-center justify-center h-32 gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No storage resources found</TableCell></TableRow>
              ) : filtered.map(dv => (
                <TableRow key={dv.metadata.uid} className="hover:bg-muted/50">
                  <TableCell className="h-9 px-3 py-1.5"><input type="checkbox" className="size-4 rounded border-border accent-primary" aria-label={`Select ${dv.metadata.name}`} /></TableCell>
                  <TableCell className="h-9 px-3 py-1.5">
                    <Link to={`/kubevirt/cdi/data-volumes/${dv.metadata.namespace}/${dv.metadata.name}/overview`} className="font-semibold text-primary hover:underline">{dv.metadata.name}</Link>
                    <div className="text-xs text-muted-foreground">{dv.metadata.namespace}</div>
                  </TableCell>
                  <TableCell className="h-9 px-3 py-1.5"><StatusBadge status={dv.status?.phase} /></TableCell>
                  <TableCell className="h-9 px-3 py-1.5 font-mono text-sm">{dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}</TableCell>
                  <TableCell className="h-9 px-3 py-1.5 text-right text-muted-foreground text-sm">{dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const [data, setData] = useState<{ vms: VM[], vmis: VMI[], dvs: DV[], nodes: K8sNode[], kvPods: K8sPod[], pods: K8sPod[], deployments: any[], services: any[], namespaces: any[], events: K8sEvent[], loading: boolean }>({ vms: [], vmis: [], dvs: [], nodes: [], kvPods: [], pods: [], deployments: [], services: [], namespaces: [], events: [], loading: true });
  useEffect(() => {
    const load = async () => {
      try {
        const loadJson = (url: string) => apiFetch(url).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }));
        const [vmsR, vmisR, dvsR, nodesR, kvPodsR, podsR, deploymentsR, servicesR, namespacesR, eventsR] = await Promise.all([
          loadJson("/api/v1/vms"),
          loadJson("/apis/kubevirt.io/v1/virtualmachineinstances"),
          loadJson("/apis/cdi.kubevirt.io/v1beta1/datavolumes"),
          loadJson("/api/v1/nodes"),
          loadJson("/api/v1/namespaces/kubevirt/pods"),
          loadJson("/api/v1/pods"),
          loadJson("/apis/apps/v1/deployments"),
          loadJson("/api/v1/services"),
          loadJson("/api/v1/namespaces"),
          loadJson("/api/v1/events"),
        ]);
        setData({ vms: vmsR.items || [], vmis: vmisR.items || [], dvs: dvsR.items || [], nodes: nodesR.items || [], kvPods: kvPodsR.items || [], pods: podsR.items || [], deployments: deploymentsR.items || [], services: servicesR.items || [], namespaces: namespacesR.items || [], events: eventsR.items || [], loading: false });
      } catch (e) { setData(prev => ({ ...prev, loading: false })); }
    }; load();
  }, []);
  const nodeStats = useMemo(() => { const total = data.nodes.length; const unschedulable = data.nodes.filter(n => n.spec.unschedulable).length; const ready = data.nodes.filter(n => n.status.conditions.some(c => c.type === "Ready" && c.status === "True")).length; return { total, unschedulable, ready }; }, [data.nodes]);
  const nsAnalysis = useMemo(() => { const analysis: Record<string, { vmCount: number, storageGi: number }> = {}; data.vms.forEach(vm => { const ns = vm.metadata.namespace; if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 }; analysis[ns].vmCount++; }); data.dvs.forEach(dv => { const ns = dv.metadata.namespace; if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 }; const requested = dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage; analysis[ns].storageGi += parseStorage(requested); }); return Object.entries(analysis).sort((a, b) => b[1].vmCount - a[1].vmCount).map(([name, stats]) => ({ name, ...stats })); }, [data.vms, data.dvs]);
  const infraHealth = useMemo(() => { const components = ["virt-api", "virt-controller", "virt-handler"]; return components.map(c => { const pods = data.kvPods.filter(p => p.metadata.name.startsWith(c)); const healthy = pods.length > 0 && pods.every(p => p.status.phase === "Running"); return { name: c, healthy, count: pods.length }; }); }, [data.kvPods]);
  const totalStorage = nsAnalysis.reduce((acc, curr) => acc + curr.storageGi, 0);
  const workloadHealth = useMemo(() => {
    const runningPods = data.pods.filter(p => p.status.phase === "Running").length;
    const warningEvents = data.events.filter(e => e.type === "Warning").length;
    const readyDeployments = data.deployments.filter(d => (d.status?.readyReplicas || 0) >= (d.spec?.replicas || 1)).length;
    return { runningPods, warningEvents, readyDeployments };
  }, [data.pods, data.deployments, data.events]);

  if (data.loading) return (
    <div className="flex items-center justify-center h-64 gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading dashboard...</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Cluster Dashboard</h1>
        <p className="text-sm text-muted-foreground">Kubernetes and KubeVirt infrastructure overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                <Server className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardDescription>Compute Nodes</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{nodeStats.total}</CardTitle>
                <div className="text-sm text-muted-foreground">{nodeStats.ready} Ready{nodeStats.unschedulable > 0 && ` / ${nodeStats.unschedulable} Cordoned`}</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>

        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/50">
                <Cpu className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardDescription>Virtual Machines</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{data.vms.length}</CardTitle>
                <div className="text-sm text-muted-foreground">{data.vmis.length} running</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>

        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50">
                <Database className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardDescription>Disk Allocation</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{formatStorage(totalStorage)}</CardTitle>
                <div className="text-sm text-muted-foreground">{data.dvs.length} data volumes</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>

        <ShadCard className={!infraHealth.every(i => i.healthy) ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/50">
                <ShieldCheck className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardDescription>Infrastructure</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{infraHealth.every(i => i.healthy) ? "Stable" : "Degraded"}</CardTitle>
                <div className="flex gap-1.5 mt-1">
                  {infraHealth.map(i => (
                    <div key={i.name} title={i.name} className={cn("w-2 h-2 rounded-full", i.healthy ? "bg-green-500" : "bg-red-500 animate-pulse")} />
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                <Box className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardDescription>Pods</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{data.pods.length}</CardTitle>
                <div className="text-sm text-muted-foreground">{workloadHealth.runningPods} Running</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>
        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/50">
                <Layers className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardDescription>Deployments</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{data.deployments.length}</CardTitle>
                <div className="text-sm text-muted-foreground">{workloadHealth.readyDeployments} Ready</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>
        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50">
                <Network className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardDescription>Services</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{data.services.length}</CardTitle>
                <div className="text-sm text-muted-foreground">{data.namespaces.length} Namespaces</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>
        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/50">
                <Bell className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardDescription>Events</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{data.events.length}</CardTitle>
                <div className="text-sm text-muted-foreground">{workloadHealth.warningEvents} Warning</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>
      </div>

      {/* Namespace Analysis + Node Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ShadCard className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Namespace Analysis</CardTitle>
            <CardDescription>VM and storage distribution by namespace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nsAnalysis.slice(0, 8).map(ns => (
                <div key={ns.name} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm font-medium text-foreground truncate flex-1">{ns.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="gap-1"><Cpu className="size-3" />{ns.vmCount}</Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatStorage(ns.storageGi)}</span>
                  </div>
                </div>
              ))}
              {nsAnalysis.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No namespaces found</p>}
            </div>
          </CardContent>
        </ShadCard>

        <ShadCard className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Node Distribution</CardTitle>
            <CardDescription>VM placement across cluster nodes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.nodes.slice(0, 10).map(node => {
                const nodeVmis = data.vmis.filter(v => v.status.nodeName === node.metadata.name);
                const isReady = node.status.conditions.some(c => c.type === "Ready" && c.status === "True");
                return (
                  <div key={node.metadata.uid} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", isReady ? "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400")}>
                        <Server className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground break-all leading-tight">{node.metadata.name}</div>
                        <div className="text-xs text-muted-foreground">{node.status.capacity.cpu} cores / {node.status.capacity.memory}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className="gap-1"><Hash className="size-3" />{nodeVmis.length}</Badge>
                      <StatusBadge status={isReady ? "Ready" : "NotReady"} />
                    </div>
                  </div>
                );
              })}
              {data.nodes.length === 0 && <div className="col-span-2 py-8 text-center text-muted-foreground text-sm">No cluster nodes found</div>}
            </div>
          </CardContent>
        </ShadCard>
      </div>
    </div>
  );
}

function VMDetailContent() {
  const { namespace, name, tab } = useParams(); const navigate = useNavigate(); const [vm, setVm] = useState<VM | null>(null); const [vmi, setVmi] = useState<VMI | null>(null); const [vmYaml, setVmYaml] = useState(""); const [associatedDVs, setAssociatedDVs] = useState<DV[]>([]); const [events, setEvents] = useState<K8sEvent[]>([]); const [metrics, setMetrics] = useState<MetricPoint[]>([]); const [loading, setLoading] = useState(true); const [mStrategy, setMStrategy] = useState<string | null>(null);
  const activeTab = tab === "yaml" ? "manifest" : tab || "overview";
  const fetchData = async () => {
    try {
      const [vmRes, vmiRes, yamlRes, eventsRes] = await Promise.all([ apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}`), apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}`), apiFetch(`/api/v1/yaml/virtualmachines/${namespace}/${name}`), apiFetch(`/api/v1/namespaces/${namespace}/events?fieldSelector=involvedObject.name=${name}`) ]);
      const vmData = vmRes.ok ? await vmRes.json() : null; setVm(vmData); if (vmiRes.ok) setVmi(await vmiRes.json()); if (yamlRes.ok) setVmYaml(await yamlRes.text()); if (eventsRes.ok) setEvents((await eventsRes.json()).items || []);
      let strat = mStrategy; if (strat === null) { const apisRes = await apiFetch("/apis"); if (apisRes.ok) { strat = (await apisRes.json()).groups?.some((g:any) => g.name === "metrics.kubevirt.io") ? "vmi" : "pod"; setMStrategy(strat); } }
      if (strat === "vmi") { const m = await apiFetch(`/apis/metrics.kubevirt.io/v1beta1/namespaces/${namespace}/virtualmachineinstances/${name}`); if (m.ok) { const d = await m.json(); setMetrics(p => [...p.slice(-19), { timestamp: Date.now(), time: new Date().toISOString(), cpuUsage: d.status?.cpu?.usageCores || 0, memoryUsage: (d.status?.memory?.usageBytes || 0) / (1024 * 1024) }]); } }
      else if (strat === "pod") { const pod = await findVmPod(namespace!, name!); if (pod) { const pm = await apiFetch(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${pod.metadata.name}`); if (pm.ok) { const d = await pm.json(); const cpu = d.containers?.[0]?.usage?.cpu || "0n"; const mem = d.containers?.[0]?.usage?.memory || "0Ki"; const pCpu = (c:string) => c.endsWith("n") ? parseInt(c)/1e9 : c.endsWith("u") ? parseInt(c)/1e6 : c.endsWith("m") ? parseInt(c)/1e3 : parseInt(c); const pMem = (m:string) => m.endsWith("Ki") ? parseInt(m)/1024 : m.endsWith("Mi") ? parseInt(m) : m.endsWith("Gi") ? parseInt(m)*1024 : parseInt(m)/(1024*1024); setMetrics(p => [...p.slice(-19), { timestamp: Date.now(), time: new Date().toISOString(), cpuUsage: pCpu(cpu), memoryUsage: pMem(mem) }]); } } }
      if (vmData?.spec.template?.spec?.volumes) { const dns = vmData.spec.template.spec.volumes.filter((v:any) => v.dataVolume).map((v:any) => v.dataVolume.name); if (dns.length > 0) { const ds = await Promise.all(dns.map((dn:string) => apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${dn}`).then(r => r.ok ? r.json() : null))); setAssociatedDVs(ds.filter(d => d !== null)); } }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); const t = setInterval(fetchData, 5000); return () => clearInterval(t); }, [namespace, name]);
  const handleAction = async (a:string) => {
    if (a === "pause" || a === "unpause") {
      await apiFetch(`/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}/${a}`, jsonPut());
    } else if (a === "poweroff") {
      await apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ gracePeriodSeconds: 0 }),
      });
    } else if (a === "migrate") {
      await apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstancemigrations`, jsonPost({
        apiVersion: "kubevirt.io/v1",
        kind: "VirtualMachineInstanceMigration",
        metadata: { generateName: `${name}-migration-`, namespace },
        spec: { vmiName: name },
      }));
    } else {
      await apiFetch(`/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}/${a}`, jsonPut());
    }
    fetchData();
  };
  const vmPatchUrl = `/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}`;

  if (loading && !vm) return (
    <div className="flex items-center justify-center h-64 gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );
  if (!vm) return (
    <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-8">
      Virtual machine not found
    </div>
  );
  const currentCpu = vm.spec.template?.spec?.domain?.cpu || {};
  const currentMemory = vm.spec.template?.spec?.domain?.resources?.requests?.memory || "1Gi";

  const tabs = [
    { id: "overview", name: "Overview", icon: Info },
    { id: "events", name: "Events", icon: Bell },
    { id: "console", name: "Console", icon: Terminal },
    { id: "vnc", name: "VNC", icon: MousePointer2 },
    { id: "manifest", name: "Manifest", icon: FileCode },
  ];

  return (
    <div className={cn("space-y-6 animate-in fade-in duration-500", activeTab === "console" || activeTab === "vnc" ? "max-w-full" : "")}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/kubevirt/virtualization/virtual-machines")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{vm.metadata.name}</h1>
            <StatusBadge status={vm.status?.printableStatus} />
          </div>
          <p className="text-sm text-muted-foreground">{vm.metadata.namespace}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" onClick={() => handleAction('start')}>Start</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('stop')}>Stop</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('restart')}>Restart</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('pause')}>Pause</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('unpause')}>Resume</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('migrate')}>Migrate</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('poweroff')}>Power Off</Button>
          <VmActionDialog
            label="Resize"
            description="Patch CPU sockets, cores, threads, and requested memory on this VM template."
            fields={[
              { name: "sockets", label: "Sockets", type: "number", defaultValue: String(currentCpu.sockets || 1) },
              { name: "cores", label: "Cores", type: "number", defaultValue: String(currentCpu.cores || 1) },
              { name: "threads", label: "Threads", type: "number", defaultValue: String(currentCpu.threads || 1) },
              { name: "memory", label: "Memory", defaultValue: currentMemory },
            ]}
            buildRequest={(values) => ({
              url: vmPatchUrl,
              options: mergePatch({
                spec: {
                  template: {
                    spec: {
                      domain: {
                        cpu: {
                          sockets: numberValue(values.sockets, 1),
                          cores: numberValue(values.cores, 1),
                          threads: numberValue(values.threads, 1),
                        },
                        resources: { requests: { memory: stringValue(values.memory, "1Gi") } },
                      },
                    },
                  },
                },
              }),
            })}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Run Strategy"
            description="Patch spec.runStrategy on this VirtualMachine."
            fields={[{ name: "runStrategy", label: "Run Strategy", type: "select", defaultValue: vm.spec.runStrategy || "Halted", options: [{ label: "Always", value: "Always" }, { label: "Halted", value: "Halted" }, { label: "Manual", value: "Manual" }] }]}
            buildRequest={(values) => ({ url: vmPatchUrl, options: mergePatch({ spec: { runStrategy: stringValue(values.runStrategy, "Halted") } }) })}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Instance Type"
            description="Patch spec.instancetype.name on this VirtualMachine."
            fields={[{ name: "instanceType", label: "Cluster Instance Type", defaultValue: String((vm.spec as any).instancetype?.name || "") }]}
            buildRequest={(values) => ({ url: vmPatchUrl, options: mergePatch({ spec: { instancetype: { name: stringValue(values.instanceType) } } }) })}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Priority Class"
            description="Patch template priorityClassName on this VirtualMachine."
            fields={[{ name: "priorityClassName", label: "Priority Class Name", defaultValue: String((vm.spec.template?.spec as any)?.priorityClassName || "") }]}
            buildRequest={(values) => ({ url: vmPatchUrl, options: mergePatch({ spec: { template: { spec: { priorityClassName: stringValue(values.priorityClassName) } } } }) })}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Metadata"
            description="Patch VM and VM template labels/annotations from key=value lines."
            fields={[
              { name: "labels", label: "Labels", type: "textarea", defaultValue: keyValueText(vm.metadata.labels) },
              { name: "annotations", label: "Annotations", type: "textarea", defaultValue: keyValueText(vm.metadata.annotations) },
            ]}
            buildRequest={(values) => {
              const labels = parseKeyValueText(values.labels || "");
              const annotations = parseKeyValueText(values.annotations || "");
              return {
                url: vmPatchUrl,
                options: mergePatch({
                  metadata: { labels, annotations },
                  spec: { template: { metadata: { labels, annotations } } },
                }),
              };
            }}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Hotplug Volume"
            description="Attach an existing DataVolume to the running VMI."
            fields={[
              { name: "volume", label: "DataVolume Name", defaultValue: "" },
              { name: "type", label: "Device Type", type: "select", defaultValue: "disk", options: [{ label: "Disk", value: "disk" }, { label: "CD-ROM", value: "cdrom" }, { label: "LUN", value: "lun" }] },
              { name: "cache", label: "Cache Mode", type: "select", defaultValue: "none", options: [{ label: "none", value: "none" }, { label: "writeback", value: "writeback" }, { label: "writethrough", value: "writethrough" }] },
              { name: "readonly", label: "Read Only", type: "select", defaultValue: "false", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] },
            ]}
            buildRequest={(values) => {
              const volume = stringValue(values.volume);
              const readonly = values.readonly === "true";
              const disk: Record<string, unknown> = { name: volume, serial: volume, cache: stringValue(values.cache, "none") };
              if (values.type === "cdrom") disk.cdrom = { readonly };
              else if (values.type === "lun") disk.lun = { readonly, bus: "scsi" };
              else disk.disk = { readonly, bus: "scsi" };
              return {
                url: `/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}/addvolume`,
                options: jsonPut({ name: volume, disk, volumeSource: { dataVolume: { name: volume, hotpluggable: true } } }),
              };
            }}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Unplug Volume"
            description="Detach a hotplugged volume from the running VMI."
            fields={[{ name: "volume", label: "Volume Name", defaultValue: "" }]}
            buildRequest={(values) => ({
              url: `/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}/removevolume`,
              options: jsonPut({ name: stringValue(values.volume) }),
            })}
            onDone={fetchData}
          />
          <VmActionDialog
            label="Delete"
            description="Delete this VirtualMachine resource."
            fields={[]}
            variant="destructive"
            buildRequest={() => ({
              url: `/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}`,
              options: { method: "DELETE", headers: { Accept: "application/json" } },
            })}
            onDone={() => navigate("/kubevirt/virtualization/virtual-machines")}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <Link
            key={t.id}
            to={`/kubevirt/virtualization/virtual-machines/${namespace}/${name}/${t.id}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.name}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Info cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Run Strategy</CardDescription>
                  <CardTitle className="text-sm font-medium">{vm.spec.runStrategy || "Default"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Desired State</span>
                    <span className="font-medium">{vm.spec.running ? "Active" : "Halted"}</span>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Compute</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-semibold tabular-nums">{[vm.spec.template?.spec?.domain?.cpu?.sockets || 1, vm.spec.template?.spec?.domain?.cpu?.cores || 1, vm.spec.template?.spec?.domain?.cpu?.threads || 1].join("x")}</div>
                      <div className="text-xs text-muted-foreground">Sockets x Cores x Threads</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">{vm.spec.template?.spec?.domain?.resources?.requests?.memory || "1Gi"}</div>
                      <div className="text-xs text-muted-foreground">Memory</div>
                    </div>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Runtime Status</CardDescription>
                </CardHeader>
                <CardContent>
                  {vmi ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Phase</span>
                        <span className="font-medium">{vmi.status.phase}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Node</span>
                        <span className="font-mono text-xs">{vmi.status.nodeName}</span>
                      </div>
                      <div className="text-base font-mono mt-1">{vmi.status.interfaces?.[0]?.ipAddress || "Pending IP..."}</div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active instance</p>
                  )}
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Scheduling</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Priority Class</span>
                    <span className="font-medium">{(vm.spec.template?.spec as any)?.priorityClassName || "N/A"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Architecture</span>
                    <span className="font-medium">{vm.spec.template?.spec?.architecture || "N/A"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Machine</span>
                    <span className="font-medium">{vm.spec.template?.spec?.domain?.machine?.type || "N/A"}</span>
                  </div>
                </CardContent>
              </ShadCard>
            </div>

            {/* Metrics charts */}
            {vmi && metrics.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <ShadCard>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">CPU Usage</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer>
                        <AreaChart data={metrics}>
                          <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                          <XAxis dataKey="time" hide />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(2)}`} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px' }} />
                          <Area type="monotone" dataKey="cpuUsage" stroke="var(--primary)" fill="url(#colorCpu)" animationDuration={300} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </ShadCard>

                <ShadCard>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">Memory Usage (MB)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer>
                        <AreaChart data={metrics}>
                          <defs>
                            <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                          <XAxis dataKey="time" hide />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v)}`} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px' }} />
                          <Area type="monotone" dataKey="memoryUsage" stroke="var(--primary)" fill="url(#colorMem)" animationDuration={300} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </ShadCard>
              </div>
            )}

            {/* Metadata, Storage, Networking */}
            <div className="grid gap-4 lg:grid-cols-3">
              <RelatedPodsCard
                className="lg:col-span-3"
                title="Virtual Machine Pods"
                description="Pods created for this VM runtime. Use these for logs and shell access."
                namespace={namespace!}
                selectors={vmPodSelectors(name!)}
              />

              <ShadCard className="lg:col-span-3">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Metadata</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">Labels</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(vm.spec.template?.metadata?.labels || {}).map(([k, v]) => (
                          <span key={k} className="px-2 py-1 bg-muted text-foreground rounded-md text-xs border">{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">Annotations</div>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(vm.spec.template?.metadata?.annotations || {}).slice(0, 8).map(([k, v]) => (
                          <CopyableText key={k} label={k} text={String(v)} />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Storage</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {associatedDVs.map(d => (
                      <div key={d.metadata.uid} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-lg border gap-4">
                        <Link to={`/kubevirt/cdi/data-volumes/${d.metadata.namespace}/${d.metadata.name}/overview`} className="font-medium hover:text-primary transition-colors flex-1">{d.metadata.name}</Link>
                        <StatusBadge status={d.status?.phase} />
                      </div>
                    ))}
                    {associatedDVs.length === 0 && <p className="text-sm text-muted-foreground">No storage volumes</p>}
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Disks</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {((vm.spec.template?.spec?.domain?.devices as any)?.disks || []).map((disk: any) => (
                      <div key={disk.name} className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
                        <div className="font-medium">{disk.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {disk.disk ? `disk ${disk.disk.bus || ""}` : disk.cdrom ? `cdrom ${disk.cdrom.bus || ""}` : disk.lun ? `lun ${disk.lun.bus || ""}` : "device"}
                          {disk.bootOrder ? ` / boot ${disk.bootOrder}` : ""}
                        </div>
                      </div>
                    ))}
                    {(((vm.spec.template?.spec?.domain?.devices as any)?.disks || []).length === 0) && <p className="text-sm text-muted-foreground">No disks declared</p>}
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Volumes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(vm.spec.template?.spec?.volumes || []).map((volume: any) => (
                      <div key={volume.name} className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
                        <div className="font-medium">{volume.name}</div>
                        <div className="text-xs text-muted-foreground">{Object.keys(volume).filter((key) => key !== "name").join(", ") || "volume"}</div>
                      </div>
                    ))}
                    {(vm.spec.template?.spec?.volumes || []).length === 0 && <p className="text-sm text-muted-foreground">No volumes declared</p>}
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Networking</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(vm.spec.template?.spec?.domain?.devices?.interfaces || []).map((i: any) => (
                      <div key={i.name} className="grid gap-1 text-sm p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium">{i.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{vmi?.status.interfaces?.find((runtime) => runtime.name === i.name)?.ipAddress || "disconnected"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{Object.keys(i).filter((key) => key !== "name").join(", ")}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-sm">Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {(vm.status?.conditions || []).map((condition) => (
                      <div key={condition.type} className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm">{condition.type}</span>
                          <StatusBadge status={condition.status} />
                        </div>
                        {(condition.reason || condition.message) && <p className="mt-2 text-xs text-muted-foreground">{condition.reason} {condition.message}</p>}
                      </div>
                    ))}
                    {(vm.status?.conditions || []).length === 0 && <p className="text-sm text-muted-foreground">No conditions reported</p>}
                  </div>
                </CardContent>
              </ShadCard>
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <ShadCard className="p-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()).map(e => (
                    <TableRow key={e.metadata.uid} className="hover:bg-muted/50">
                      <TableCell><Badge variant={e.type === "Normal" ? "outline" : "danger"}>{e.type}</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{e.reason}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-md">{e.message}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                        <span className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" />{e.lastTimestamp || "N/A"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No events found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </ShadCard>
        )}

        {activeTab === "console" && <SerialConsole namespace={namespace!} name={name!} />}
        {activeTab === "vnc" && <VncConsole namespace={namespace!} name={name!} />}

        {activeTab === "manifest" && (
          <ShadCard>
            <CardContent className="p-0">
              <pre className="p-6 text-sm font-mono text-foreground bg-muted/30 rounded-lg overflow-x-auto min-h-[400px] whitespace-pre">{vmYaml || "Fetching..."}</pre>
            </CardContent>
          </ShadCard>
        )}
      </div>
    </div>
  );
}

function DVDetailContent() {
  const { namespace, name, tab } = useParams(); const navigate = useNavigate(); const [dv, setDv] = useState<DV | null>(null); const [dvYaml, setDvYaml] = useState(""); const [loading, setLoading] = useState(true); const activeTab = tab === "yaml" ? "manifest" : tab || "overview";
  const loadDv = async () => {
    setLoading(true);
    try {
      const [r, y] = await Promise.all([apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${name}`), apiFetch(`/api/v1/yaml/datavolumes/${namespace}/${name}`)]);
      if (r.ok) setDv(await r.json()); if (y.ok) setDvYaml(await y.text());
    } finally { setLoading(false); }
  };
  useEffect(() => { loadDv(); }, [namespace, name]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );
  if (!dv) return (
    <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-8">
      DataVolume not found
    </div>
  );

  const tabs = [
    { id: "overview", name: "Overview", icon: Info },
    { id: "manifest", name: "Manifest", icon: FileCode },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{dv.metadata.name}</h1>
            <StatusBadge status={dv.status?.phase} />
          </div>
          <p className="text-sm text-muted-foreground">{dv.metadata.namespace}</p>
        </div>
        <VmActionDialog
          label="Resize"
          description="Resize the bound PVC for this DataVolume."
          fields={[{
            name: "storage",
            label: "Storage Size",
            defaultValue: dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "10Gi",
          }]}
          buildRequest={(values) => ({
            url: `/api/v1/namespaces/${namespace}/persistentvolumeclaims/${dv.status?.claimName || name}`,
            options: mergePatch({ spec: { resources: { requests: { storage: stringValue(values.storage, "10Gi") } } } }),
          })}
          onDone={loadDv}
        />
        <VmActionDialog
          label="Metadata"
          description="Patch DataVolume labels and annotations from key=value lines."
          fields={[
            { name: "labels", label: "Labels", type: "textarea", defaultValue: keyValueText(dv.metadata.labels) },
            { name: "annotations", label: "Annotations", type: "textarea", defaultValue: keyValueText(dv.metadata.annotations) },
          ]}
          buildRequest={(values) => ({
            url: `/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${name}`,
            options: mergePatch({ metadata: { labels: parseKeyValueText(values.labels || ""), annotations: parseKeyValueText(values.annotations || "") } }),
          })}
          onDone={loadDv}
        />
        <VmActionDialog
          label="Delete"
          description="Delete this DataVolume resource."
          fields={[]}
          buildRequest={() => ({
            url: `/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${name}`,
            options: { method: "DELETE", headers: { Accept: "application/json" } },
          })}
          onDone={() => navigate("/kubevirt/cdi/data-volumes")}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <Link
            key={t.id}
            to={`/kubevirt/cdi/data-volumes/${namespace}/${name}/${t.id}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.name}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Capacity</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}
                  </CardTitle>
                </CardHeader>
              </ShadCard>
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Transfer Progress</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">{dv.status?.progress || "100%"}</CardTitle>
                </CardHeader>
              </ShadCard>
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Source</CardDescription>
                  <CardTitle className="text-sm font-medium">{dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"}</CardTitle>
                </CardHeader>
              </ShadCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ShadCard>
                <CardHeader>
                  <CardTitle className="text-sm">Storage Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Storage Class</span>
                    <span className="font-medium">{(dv.spec.storage as any)?.storageClassName || (dv.spec.pvc as any)?.storageClassName || "default"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Access Modes</span>
                    <span className="font-medium">{(dv.spec.storage as any)?.accessModes?.join(", ") || (dv.spec.pvc as any)?.accessModes?.join(", ") || "N/A"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Volume Mode</span>
                    <span className="font-medium">{(dv.spec.storage as any)?.volumeMode || (dv.spec.pvc as any)?.volumeMode || "N/A"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Claim</span>
                    <span className="font-medium">{dv.status?.claimName || dv.metadata.name}</span>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <CardTitle className="text-sm">Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(dv.spec.source || {}).map(([sourceType, value]) => (
                      <div key={sourceType} className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-sm font-medium">{sourceType}</div>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{JSON.stringify(value, null, 2)}</pre>
                      </div>
                    ))}
                    {!dv.spec.source && <p className="text-sm text-muted-foreground">No source declared</p>}
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <CardTitle className="text-sm">Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(dv.status?.conditions || []).map((condition) => (
                      <div key={condition.type} className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm">{condition.type}</span>
                          <StatusBadge status={condition.status} />
                        </div>
                        {(condition.reason || condition.message) && <p className="mt-2 text-xs text-muted-foreground">{condition.reason} {condition.message}</p>}
                      </div>
                    ))}
                    {(dv.status?.conditions || []).length === 0 && <p className="text-sm text-muted-foreground">No conditions reported</p>}
                  </div>
                </CardContent>
              </ShadCard>
            </div>

            <ShadCard>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Metadata</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Labels</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dv.metadata.labels || {}).map(([k, v]) => (
                        <span key={k} className="px-2 py-1 bg-muted text-foreground rounded-md text-xs border">{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Annotations</div>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(dv.metadata.annotations || {}).slice(0, 12).map(([k, v]) => (
                        <CopyableText key={k} label={k} text={String(v)} />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </ShadCard>
          </div>
        ) : (
          <ShadCard>
            <CardContent className="p-0">
              <pre className="p-6 text-sm font-mono text-foreground bg-muted/30 rounded-lg overflow-x-auto min-h-[400px] whitespace-pre">{dvYaml || "Loading..."}</pre>
            </CardContent>
          </ShadCard>
        )}
      </div>
    </div>
  );
}

function resourceRoutes(config: ResourceConfig) {
  return [
    <Route key={`${config.path}-list`} path={config.path} element={<ResourceList config={config} />} />,
    <Route key={`${config.path}-detail`} path={`${config.path}/:namespace/:name`} element={<ResourceDetail config={config} />} />,
    <Route key={`${config.path}-manifest`} path={`${config.path}/:namespace/:name/manifest`} element={<ResourceManifest config={config} />} />,
  ];
}

function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-h-0 overflow-y-auto">
          <SiteHeader />
          <div className="flex flex-1 flex-col p-4 lg:p-8 max-w-[100rem] mx-auto w-full">
            <Routes>
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/kubernetes" element={<KubernetesManagementPage />} />
              <Route path="/kubernetes/:category" element={<KubernetesCategoryPage />} />
              <Route path="/kubevirt" element={<KubeVirtManagementPage />} />
              <Route path="/kubevirt/:category" element={<KubeVirtCategoryPage />} />
              <Route path="/kubevirt/virtualization/virtual-machines" element={<VMList />} />
              <Route path="/kubevirt/virtualization/virtual-machines/:namespace/:name" element={<Navigate to="overview" replace />} />
              <Route path="/kubevirt/virtualization/virtual-machines/:namespace/:name/:tab" element={<VMDetailContent />} />
              <Route path="/kubevirt/cdi/data-volumes" element={<DVList />} />
              <Route path="/kubevirt/cdi/data-volumes/:namespace/:name" element={<Navigate to="overview" replace />} />
              <Route path="/kubevirt/cdi/data-volumes/:namespace/:name/:tab" element={<DVDetailContent />} />
              <Route path="/storage" element={<StorageManagementPage />} />
              <Route path="/storage/:category" element={<StorageCategoryPage />} />
              <Route path="/networks" element={<NetworkManagementPage />} />
              <Route path="/networks/:category" element={<NetworkCategoryPage />} />
              {Object.values(resourceConfigs).flatMap(resourceRoutes)}
              <Route path="*" element={<div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-12">Page not found</div>} />
            </Routes>
          </div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </BrowserRouter>
  );
}

export default App;
