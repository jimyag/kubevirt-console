import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import * as YAML from "js-yaml"
import {
  AlertTriangle,
  ChevronLeft,
  Code2,
  FilePlus2,
  Inbox,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  apiVersionFromListPath,
  expandListPaths as listPaths,
  resourceNameFromListPath,
  resourcePathFromListPath,
} from "@/resources/api-paths"
import { RelatedPodsCard, type PodSummary } from "@/components/pod-access"

type KubeResource = {
  apiVersion?: string
  kind?: string
  metadata: {
    name: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    ownerReferences?: Array<{ apiVersion?: string; kind?: string; name?: string; uid?: string; controller?: boolean }>
  }
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  [key: string]: unknown
}

export type CreateFormField = {
  name: string
  label: string
  section?: string
  type?: "text" | "number" | "textarea" | "select" | "checkbox"
  defaultValue?: string | boolean | ((resource: KubeResource) => string | boolean)
  placeholder?: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
  description?: string
}

export type DetailSection = {
  title: string
  description?: string
  items: Array<{ label: string; value: unknown; fullWidth?: boolean }>
}

export type ResourceAction = {
  id: string
  label: string
  description?: string
  fields?: CreateFormField[]
  confirmLabel?: string
  variant?: "default" | "outline" | "destructive" | "secondary"
  buildRequest: (resource: KubeResource, values: Record<string, string | boolean>) => {
    url: string
    options?: RequestInit
    navigateTo?: string
  }
}

export type ResourceConfig = {
  id: string
  path: string
  title: string
  subtitle: string
  listPath: string
  listPathAlternates?: string[]
  namespaced: boolean
  resourcePath: string
  resourcePathAlternates?: string[]
  kind: string
  createTemplate: string
  allowCreate?: boolean
  allowDelete?: boolean
  createFields?: CreateFormField[]
  buildCreateResource?: (values: Record<string, string | boolean>) => KubeResource | KubeResource[]
  createResourcePath?: (resource: KubeResource) => string
  detailSections?: (resource: KubeResource) => DetailSection[]
  actions?: ResourceAction[]
  statusPath?: string[]
  extraColumns?: Array<{
    label: string
    value: (resource: KubeResource) => string
  }>
}

const getContext = () => localStorage.getItem("kube-context") || ""

const apiFetch = (url: string, options: RequestInit = {}) => {
  const ctx = getContext()
  const headers = new Headers(options.headers || {})
  if (ctx) headers.set("X-Kube-Context", ctx)
  return fetch(url, { ...options, headers })
}

type ServedPath = {
  listPath: string
  resourcePath: string
  apiVersion: string
}

type DiscoveryData = {
  apiVersions: string[]
  apiResources: Array<{ name: string; apiVersion: string }>
}

type DiscoveryIndex = {
  apiVersions: Set<string>
  apiResources: Set<string>
}

const discoveryCache = new Map<string, Promise<DiscoveryIndex>>()

const cacheKey = (path: string) => `${getContext()}\n${path}`

const getDiscoveryIndex = () => {
  const key = cacheKey("discovery")
  const cached = discoveryCache.get(key)
  if (cached) return cached

  const request = apiFetch("/api/v1/discovery")
    .then(async (response) => {
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as DiscoveryData
      return {
        apiVersions: new Set(data.apiVersions || []),
        apiResources: new Set((data.apiResources || []).map((resource) => `${resource.apiVersion}/${resource.name}`)),
      }
    })

  discoveryCache.set(key, request)
  return request
}

const servedPaths = async (config: ResourceConfig): Promise<ServedPath[]> => {
  const discovery = await getDiscoveryIndex()
  return listPaths(config).filter((path) => {
    const apiVersion = apiVersionFromListPath(path)
    const resourceName = resourceNameFromListPath(path, config.id)
    return discovery.apiVersions.has(apiVersion) && discovery.apiResources.has(`${apiVersion}/${resourceName}`)
  }).map((listPath) => ({
    listPath,
    resourcePath: resourcePathFromListPath(listPath),
    apiVersion: apiVersionFromListPath(listPath),
  }))
}

const resourcePathUrl = (config: ResourceConfig, basePath: string, name: string, namespace?: string) => {
  const nsPath = config.namespaced ? `/namespaces/${namespace}` : ""
  return `${basePath}${nsPath}/${config.id}/${name}`
}

const createPathUrl = (config: ResourceConfig, basePath: string, resource: KubeResource) =>
  config.namespaced
    ? `${basePath}/namespaces/${resource.metadata.namespace}/${config.id}`
    : `${basePath}/${config.id}`

const getValue = (obj: unknown, path?: string[]) => {
  if (!path) return undefined
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}

const statusVariant = (value?: string) => {
  const lower = (value || "").toLowerCase()
  if (lower.includes("true") || lower.includes("ready") || lower.includes("running") || lower.includes("bound")) return "success"
  if (lower.includes("false") || lower.includes("failed") || lower.includes("error")) return "danger"
  if (lower.includes("pending") || lower.includes("progress") || lower.includes("unknown")) return "warning"
  return "outline"
}

const compactValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "N/A"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (Array.isArray(value)) return value.length ? value.map(compactValue).join(", ") : "None"
  if (typeof value === "object") return `${Object.keys(value as Record<string, unknown>).length} fields`
  return String(value)
}

const isPrimitiveDetailValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  ["string", "number", "boolean"].includes(typeof value)

const conditionStatusVariant = (status?: unknown) => statusVariant(String(status || ""))

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const detailObjectTitle = (value: Record<string, unknown>, fallback: string) => {
  const title = value.name || value.type || value.action || value.protocol || value.kind || value.id
  return isPrimitiveDetailValue(title) && title !== undefined && title !== null && title !== "" ? compactValue(title) : fallback
}

const asRecord = (value: unknown) => isRecordValue(value) ? value : {}
const asRecordList = (value: unknown) => Array.isArray(value) ? value.filter(isRecordValue) : []
const joinList = (value: unknown) => Array.isArray(value) ? value.map(compactValue).join(", ") : compactValue(value)
const objectLabels = (value: unknown) => Object.entries(asRecord(value)).map(([key, next]) => `${key}=${compactValue(next)}`)
const resourceKeys = (value: Record<string, unknown>) => Object.keys(value).filter((key) => key !== "name" && hasRenderableValue(value[key]))
const hasRenderableValue = (value: unknown) => !(value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))

function CompactKvTable({ rows }: { rows: Array<{ label: string; value: unknown }> }) {
  const visible = rows.filter((row) => hasRenderableValue(row.value))
  if (visible.length === 0) return <span className="text-sm text-muted-foreground">None</span>
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableBody>
          {visible.map((row) => (
            <TableRow key={row.label} className="hover:bg-muted/50">
              <TableCell className="w-44 py-2 text-xs font-medium text-muted-foreground">{row.label}</TableCell>
              <TableCell className="min-w-0 py-2 text-sm text-foreground">
                {isPrimitiveDetailValue(row.value) ? compactValue(row.value) : <DetailValue value={row.value} depth={2} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ChipList({ values }: { values: unknown[] }) {
  if (values.length === 0) return <span className="text-sm text-muted-foreground">None</span>
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {values.slice(0, 20).map((item, index) => (
        <span key={`${compactValue(item)}-${index}`} className="min-w-0 max-w-full break-words rounded-md border bg-muted px-2 py-1 text-xs text-foreground">
          {compactValue(item)}
        </span>
      ))}
      {values.length > 20 && <span className="text-xs text-muted-foreground">+{values.length - 20} more</span>}
    </div>
  )
}

function DetailContainerTable({ containers, statuses }: { containers: Record<string, unknown>[]; statuses?: Record<string, unknown>[] }) {
  if (containers.length === 0) return <span className="text-sm text-muted-foreground">No containers</span>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[880px]">
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="text-xs">Name</TableHead>
            <TableHead className="text-xs">Image</TableHead>
            <TableHead className="text-xs">Ready</TableHead>
            <TableHead className="text-xs">Restarts</TableHead>
            <TableHead className="text-xs">Ports</TableHead>
            <TableHead className="text-xs">Resources</TableHead>
            <TableHead className="text-xs">Args</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {containers.map((container) => {
            const status = statuses?.find((item) => item.name === container.name) || {}
            const resources = asRecord(container.resources)
            const requests = asRecord(resources.requests)
            const limits = asRecord(resources.limits)
            const ports = asRecordList(container.ports)
            return (
              <TableRow key={String(container.name)} className="hover:bg-muted/50">
                <TableCell className="font-semibold">{compactValue(container.name)}</TableCell>
                <TableCell className="max-w-[260px] break-all text-xs text-muted-foreground">{compactValue(container.image)}</TableCell>
                <TableCell><Badge variant={status.ready ? "success" : "outline"}>{compactValue(status.ready)}</Badge></TableCell>
                <TableCell className="tabular-nums">{compactValue(status.restartCount ?? 0)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ports.length ? ports.map((port) => `${compactValue(port.containerPort || port.port)}/${compactValue(port.protocol || "TCP")}`).join(", ") : "None"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[Object.keys(requests).length ? `req ${objectLabels(requests).join(", ")}` : "", Object.keys(limits).length ? `lim ${objectLabels(limits).join(", ")}` : ""].filter(Boolean).join(" / ") || "None"}
                </TableCell>
                <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                  <div className="line-clamp-3 break-words">{joinList(container.args) || joinList(container.command) || "None"}</div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function DetailVolumeTable({ volumes }: { volumes: Record<string, unknown>[] }) {
  if (volumes.length === 0) return <span className="text-sm text-muted-foreground">No volumes</span>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[720px]">
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="text-xs">Name</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {volumes.map((volume) => {
            const type = resourceKeys(volume)[0] || "volume"
            const source = asRecord(volume[type])
            return (
              <TableRow key={String(volume.name)} className="hover:bg-muted/50">
                <TableCell className="font-semibold">{compactValue(volume.name)}</TableCell>
                <TableCell>{type}</TableCell>
                <TableCell className="break-words text-xs text-muted-foreground">
                  {Object.keys(source).length ? objectLabels(source).join(", ") : compactValue(volume[type])}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function DetailSimpleObjectTable({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => isPrimitiveDetailValue(row[key]))))).slice(0, 6)
  if (keys.length === 0) return <ChipList values={rows.map((row, index) => detailObjectTitle(row, `Item ${index + 1}`))} />
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[640px]">
        <TableHeader className="bg-muted">
          <TableRow>{keys.map((key) => <TableHead key={key} className="text-xs">{key}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 12).map((row, index) => (
            <TableRow key={index} className="hover:bg-muted/50">
              {keys.map((key) => <TableCell key={key} className="max-w-[220px] break-words text-xs">{compactValue(row[key])}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 12 && <div className="border-t px-3 py-2 text-xs text-muted-foreground">+{rows.length - 12} more</div>}
    </div>
  )
}

function DetailValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (isPrimitiveDetailValue(value)) {
    return <span>{compactValue(value)}</span>
  }

  if (depth > 4) {
    return (
      <pre className="max-h-56 max-w-full overflow-auto rounded-lg border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">
        {YAML.dump(value, { noRefs: true, lineWidth: 120 })}
      </pre>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>None</span>

    const conditionLike = value.every((item) => isRecordValue(item) && "type" in item)
    if (conditionLike) {
      return (
        <div className="grid gap-2">
          {value.map((item, index) => {
            const condition = item as Record<string, unknown>
            return (
              <div key={`${String(condition.type || "condition")}-${index}`} className="rounded-lg border bg-muted/30 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{compactValue(condition.type)}</span>
                  <Badge variant={conditionStatusVariant(condition.status)}>{compactValue(condition.status)}</Badge>
                </div>
                {Boolean(condition.reason || condition.message) && (
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {[condition.reason, condition.message].filter(Boolean).map(compactValue).join(" - ")}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    const objectLike = value.every((item) => isRecordValue(item))
    if (objectLike) {
      const records = value as Record<string, unknown>[]
      if (records.every((item) => "image" in item && "name" in item)) {
        return <DetailContainerTable containers={records} />
      }
      if (records.every((item) => "name" in item && resourceKeys(item).length > 0) && records.some((item) => ["hostPath", "persistentVolumeClaim", "configMap", "secret", "emptyDir", "projected", "downwardAPI", "csi"].some((key) => key in item))) {
        return <DetailVolumeTable volumes={records} />
      }
      if (records.every((item) => "key" in item || "effect" in item || "operator" in item)) {
        return <DetailSimpleObjectTable rows={records} />
      }
      if (records.every((item) => Object.values(item).every((next) => isPrimitiveDetailValue(next)))) {
        return <DetailSimpleObjectTable rows={records} />
      }
      return (
        <div className="grid gap-2">
          {value.slice(0, 12).map((item, index) => {
            const record = item as Record<string, unknown>
            const entries = Object.entries(record)
            return (
              <div key={index} className="min-w-0 max-w-full rounded-lg border bg-muted/30 px-3 py-2">
                <div className="mb-2 min-w-0 break-words text-xs font-semibold text-foreground">
                  {detailObjectTitle(record, `Item ${index + 1}`)}
                </div>
                <div className="grid min-w-0 gap-1.5">
                  {entries.map(([key, nextValue]) => (
                    <div key={key} className="grid min-w-0 gap-1 rounded-md border bg-background/40 px-2 py-1.5">
                      <span className="min-w-0 break-all text-xs text-muted-foreground">{key}</span>
                      <div className="min-w-0 break-words text-xs text-foreground">
                        <DetailValue value={nextValue} depth={depth + 1} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {value.length > 12 && <span className="text-xs text-muted-foreground">+{value.length - 12} more</span>}
        </div>
      )
    }

    return (
      <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
        {value.slice(0, 12).map((item, index) => (
          <span key={index} className="min-w-0 max-w-full break-words rounded-md border bg-muted px-2 py-1 text-xs text-foreground">
            {compactValue(item)}
          </span>
        ))}
        {value.length > 12 && <span className="text-xs text-muted-foreground">+{value.length - 12} more</span>}
      </div>
    )
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return <span>None</span>

  return (
    <div className="grid min-w-0 max-w-full gap-1.5">
      {entries.map(([key, nextValue]) => (
        <div key={key} className="grid min-w-0 max-w-full gap-1 rounded-md border bg-muted/30 px-2 py-1.5">
          <span className="min-w-0 break-all text-xs text-muted-foreground">{key}</span>
          <div className="min-w-0 break-words text-xs text-foreground">
            <DetailValue value={nextValue} depth={depth + 1} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DetailTabs({ config, namespace, name, active }: { config: ResourceConfig; namespace?: string; name?: string; active: "overview" | "manifest" }) {
  const scopedNamespace = namespace || "_cluster"
  const tabs = [
    { id: "overview", label: "Overview", to: `${config.path}/${scopedNamespace}/${name}` },
    { id: "manifest", label: "Manifest", to: `${config.path}/${scopedNamespace}/${name}/manifest` },
  ] as const

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            active === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

const defaultDetailSections = (resource: KubeResource): DetailSection[] => [
  {
    title: "Metadata",
    items: [
      { label: "Name", value: resource.metadata.name },
      { label: "Namespace", value: resource.metadata.namespace || "cluster scoped" },
      { label: "Created", value: resource.metadata.creationTimestamp },
      { label: "UID", value: resource.metadata.uid },
    ],
  },
  {
    title: "Status",
    items: Object.entries(resource.status || {})
      .filter(([, value]) => isPrimitiveDetailValue(value) || (Array.isArray(value) && value.every((item) => item && typeof item === "object" && "type" in (item as Record<string, unknown>))))
      .slice(0, 8)
      .map(([label, value]) => ({ label, value })),
  },
]

const selectorFromMatchLabels = (value: unknown) => {
  if (!isRecordValue(value)) return undefined
  const selector = Object.fromEntries(
    Object.entries(value).filter(([, nextValue]) => isPrimitiveDetailValue(nextValue) && nextValue !== "")
  ) as Record<string, string>
  return Object.keys(selector).length > 0 ? selector : undefined
}

const podLikeResource = (resource: KubeResource): PodSummary => ({
  metadata: {
    name: resource.metadata.name,
    namespace: resource.metadata.namespace,
    uid: resource.metadata.uid,
    labels: resource.metadata.labels,
    creationTimestamp: resource.metadata.creationTimestamp,
  },
  spec: resource.spec as PodSummary["spec"],
  status: resource.status as PodSummary["status"],
})

const relatedPodsForResource = (resource: KubeResource) => {
  const namespace = resource.metadata.namespace
  if (!namespace) return undefined

  const kind = resource.kind || ""
  const spec = resource.spec || {}
  const name = resource.metadata.name

  if (kind === "Pod") {
    return { namespace, podName: name, pods: [podLikeResource(resource)], title: "Pod Access" }
  }

  const selector = selectorFromMatchLabels(getValue(resource, ["spec", "selector", "matchLabels"]))
  if (selector && ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Job"].includes(kind)) {
    return { namespace, selector, title: "Managed Pods" }
  }

  const serviceSelector = selectorFromMatchLabels((spec as Record<string, unknown>).selector)
  if (kind === "Service" && serviceSelector) {
    return { namespace, selector: serviceSelector, title: "Service Pods" }
  }

  const podSelector = selectorFromMatchLabels(getValue(resource, ["spec", "podSelector", "matchLabels"]))
  if (kind === "NetworkPolicy" && podSelector) {
    return { namespace, selector: podSelector, title: "Selected Pods" }
  }

  if (["VirtualMachine", "VirtualMachineInstance"].includes(kind)) {
    const selectors: Array<Record<string, string>> = [
      { "vm.kubevirt.io/name": name },
      { "vmi.kubevirt.io/id": name },
      { "las.qiniu.io/vm-id": name },
      { "kubevirt.io/domain": name },
    ]
    return {
      namespace,
      selectors,
      title: "Virtual Machine Pods",
    }
  }

  const templateLabels = selectorFromMatchLabels(getValue(resource, ["spec", "template", "metadata", "labels"]))
  if (templateLabels && ["VirtualMachinePool", "VirtualMachineInstanceReplicaSet"].includes(kind)) {
    return { namespace, selector: templateLabels, title: "Managed Pods" }
  }

  return undefined
}

function ResourceStatus({ resource, config }: { resource: KubeResource; config: ResourceConfig }) {
  const value =
    getValue(resource, config.statusPath) ??
    getValue(resource, ["status", "phase"]) ??
    getValue(resource, ["status", "conditions", "0", "type"]) ??
    "Active"

  return <Badge variant={statusVariant(String(value))}>{String(value)}</Badge>
}

function PodDetailOverview({ resource }: { resource: KubeResource }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  const containers = asRecordList(spec.containers)
  const initContainers = asRecordList(spec.initContainers)
  const containerStatuses = asRecordList(status.containerStatuses)
  const initContainerStatuses = asRecordList(status.initContainerStatuses)
  const volumes = asRecordList(spec.volumes)
  const conditions = asRecordList(status.conditions)
  const podIPs = asRecordList(status.podIPs).map((item) => item.ip).filter(Boolean)
  const nodeSelector = objectLabels(spec.nodeSelector)
  const tolerations = asRecordList(spec.tolerations)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Phase</CardDescription>
            <CardTitle className="text-sm font-semibold"><Badge variant={statusVariant(String(status.phase || ""))}>{compactValue(status.phase)}</Badge></CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pod IP</CardDescription>
            <CardTitle className="break-all text-sm font-semibold">{compactValue(status.podIP)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Node</CardDescription>
            <CardTitle className="break-all text-sm font-semibold">{compactValue(spec.nodeName)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>QoS</CardDescription>
            <CardTitle className="text-sm font-semibold">{compactValue(status.qosClass)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Containers</CardTitle>
          <CardDescription>Runtime readiness, image, ports, resources, and startup arguments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailContainerTable containers={containers} statuses={containerStatuses} />
          {initContainers.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Init Containers</div>
              <DetailContainerTable containers={initContainers} statuses={initContainerStatuses} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Scheduling</CardTitle>
          </CardHeader>
          <CardContent>
            <CompactKvTable rows={[
              { label: "Service Account", value: spec.serviceAccountName },
              { label: "Restart Policy", value: spec.restartPolicy },
              { label: "Priority Class", value: spec.priorityClassName },
              { label: "Priority", value: spec.priority },
              { label: "Runtime Class", value: spec.runtimeClassName },
              { label: "Node Selector", value: nodeSelector },
              { label: "Tolerations", value: tolerations },
              { label: "Start Time", value: status.startTime },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Networking</CardTitle>
          </CardHeader>
          <CardContent>
            <CompactKvTable rows={[
              { label: "Host IP", value: status.hostIP },
              { label: "Pod IPs", value: podIPs },
              { label: "DNS Policy", value: spec.dnsPolicy },
              { label: "Host Network", value: spec.hostNetwork },
              { label: "Host PID", value: spec.hostPID },
              { label: "Host IPC", value: spec.hostIPC },
            ]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Volumes</CardTitle>
          <CardDescription>Mounted volume sources declared by the pod spec.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailVolumeTable volumes={volumes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailValue value={conditions} />
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, variant }: { label: string; value: unknown; variant?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="break-words text-sm font-semibold">
          {variant ? <Badge variant={statusVariant(variant)}>{compactValue(value)}</Badge> : compactValue(value)}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function WorkloadDetailOverview({ resource }: { resource: KubeResource }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  const template = asRecord(spec.template)
  const templateSpec = asRecord(template.spec)
  const containers = asRecordList(templateSpec.containers)
  const volumes = asRecordList(templateSpec.volumes)
  const selector = asRecord(spec.selector).matchLabels || spec.selector

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Replicas" value={status.replicas ?? spec.replicas} />
        <SummaryCard label="Ready" value={status.readyReplicas} />
        <SummaryCard label="Available" value={status.availableReplicas} />
        <SummaryCard label="Updated" value={status.updatedReplicas} />
        <SummaryCard label="Unavailable" value={status.unavailableReplicas} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Rollout">
          <CompactKvTable rows={[
            { label: "Selector", value: objectLabels(selector) },
            { label: "Strategy", value: spec.strategy || spec.updateStrategy },
            { label: "Min Ready Seconds", value: spec.minReadySeconds },
            { label: "Revision History", value: spec.revisionHistoryLimit },
            { label: "Observed Generation", value: status.observedGeneration },
          ]} />
        </SectionCard>
        <SectionCard title="Pod Template">
          <CompactKvTable rows={[
            { label: "Service Account", value: templateSpec.serviceAccountName },
            { label: "Restart Policy", value: templateSpec.restartPolicy },
            { label: "Labels", value: objectLabels(asRecord(template.metadata).labels) },
            { label: "Annotations", value: objectLabels(asRecord(template.metadata).annotations) },
          ]} />
        </SectionCard>
      </div>
      <SectionCard title="Template Containers">
        <DetailContainerTable containers={containers} />
      </SectionCard>
      <SectionCard title="Template Volumes">
        <DetailVolumeTable volumes={volumes} />
      </SectionCard>
      <SectionCard title="Conditions">
        <DetailValue value={status.conditions} />
      </SectionCard>
    </div>
  )
}

function NetworkDetailOverview({ resource }: { resource: KubeResource }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Type" value={spec.type || resource.kind} />
        <SummaryCard label="Class" value={spec.ingressClassName || spec.gatewayClassName || spec.controllerName || spec.provider} />
        <SummaryCard label="Selector" value={objectLabels(spec.selector || asRecord(spec.podSelector).matchLabels).length || "N/A"} />
        <SummaryCard label="Address" value={spec.clusterIP || spec.cidrBlock || spec.cidr || spec.vpc || compactValue(asRecord(status).addresses)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Routing And Selectors">
          <CompactKvTable rows={[
            { label: "Selector", value: objectLabels(spec.selector || asRecord(spec.podSelector).matchLabels) },
            { label: "Policy Types", value: spec.policyTypes },
            { label: "Ports", value: spec.ports },
            { label: "Rules", value: spec.rules || spec.ingress || spec.egress },
            { label: "Hostnames", value: spec.hostnames },
            { label: "Parent Refs", value: spec.parentRefs },
          ]} />
        </SectionCard>
        <SectionCard title="Addresses">
          <CompactKvTable rows={[
            { label: "Cluster IP", value: spec.clusterIP },
            { label: "Cluster IPs", value: spec.clusterIPs },
            { label: "External IPs", value: spec.externalIPs },
            { label: "Load Balancer", value: status.loadBalancer },
            { label: "CIDR", value: spec.cidrBlock || spec.cidr },
            { label: "Gateway", value: spec.gateway || spec.gatewayNode },
          ]} />
        </SectionCard>
      </div>
      <SectionCard title="Status">
        <DetailValue value={status.conditions || status} />
      </SectionCard>
    </div>
  )
}

function StorageDetailOverview({ resource }: { resource: KubeResource }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Phase" value={status.phase || status.status || resource.kind} variant={String(status.phase || status.status || "")} />
        <SummaryCard label="Capacity" value={asRecord(status.capacity).storage || asRecord(spec.resources).requests} />
        <SummaryCard label="Storage Class" value={spec.storageClassName || resource.storageClassName || resource.provisioner} />
        <SummaryCard label="Access Modes" value={spec.accessModes || resource.reclaimPolicy} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Storage">
          <CompactKvTable rows={[
            { label: "Provisioner", value: resource.provisioner },
            { label: "Volume Name", value: spec.volumeName },
            { label: "Volume Mode", value: spec.volumeMode },
            { label: "Reclaim Policy", value: resource.reclaimPolicy || spec.persistentVolumeReclaimPolicy },
            { label: "Binding Mode", value: resource.volumeBindingMode },
            { label: "Expansion", value: resource.allowVolumeExpansion },
          ]} />
        </SectionCard>
        <SectionCard title="Source And Parameters">
          <CompactKvTable rows={[
            { label: "Parameters", value: resource.parameters },
            { label: "Source", value: spec.source || spec.csi || spec.hostPath || spec.nfs },
            { label: "Claim Ref", value: spec.claimRef },
            { label: "Node Affinity", value: spec.nodeAffinity },
            { label: "Conditions", value: status.conditions },
          ]} />
        </SectionCard>
      </div>
    </div>
  )
}

function VirtualizationDetailOverview({ resource }: { resource: KubeResource }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  const template = asRecord(spec.template)
  const templateSpec = asRecord(template.spec)
  const domain = asRecord(templateSpec.domain || spec.domain)
  const devices = asRecord(domain.devices)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Printable Status" value={status.printableStatus || status.phase || status.conditions} variant={String(status.printableStatus || status.phase || "")} />
        <SummaryCard label="Run Strategy" value={spec.runStrategy || spec.running} />
        <SummaryCard label="Node" value={status.nodeName} />
        <SummaryCard label="IP" value={asRecordList(status.interfaces).map((item) => item.ipAddress).filter(Boolean)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Compute">
          <CompactKvTable rows={[
            { label: "CPU", value: domain.cpu },
            { label: "Memory", value: asRecord(domain.resources).requests || spec.memory },
            { label: "Machine", value: asRecord(domain.machine).type },
            { label: "Firmware", value: domain.firmware },
            { label: "Features", value: domain.features },
          ]} />
        </SectionCard>
        <SectionCard title="Runtime">
          <CompactKvTable rows={[
            { label: "Phase", value: status.phase },
            { label: "Conditions", value: status.conditions },
            { label: "Guest OS", value: status.guestOSInfo },
            { label: "Migration", value: status.migrationState },
          ]} />
        </SectionCard>
      </div>
      <SectionCard title="Disks And Volumes">
        <div className="grid gap-4 xl:grid-cols-2">
          <DetailValue value={devices.disks || spec.disks} />
          <DetailVolumeTable volumes={asRecordList(templateSpec.volumes || spec.volumes)} />
        </div>
      </SectionCard>
      <SectionCard title="Networks">
        <DetailValue value={templateSpec.networks || devices.interfaces || spec.networks || spec.interfaces} />
      </SectionCard>
    </div>
  )
}

function NodeDetailOverview({ resource }: { resource: KubeResource }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Status" value={asRecordList(status.conditions).find((item) => item.status === "True")?.type || "Unknown"} />
        <SummaryCard label="Kubelet" value={asRecord(status.nodeInfo).kubeletVersion} />
        <SummaryCard label="OS" value={asRecord(status.nodeInfo).osImage} />
        <SummaryCard label="Unschedulable" value={spec.unschedulable || false} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Capacity"><CompactKvTable rows={Object.entries(asRecord(status.capacity)).map(([label, value]) => ({ label, value }))} /></SectionCard>
        <SectionCard title="Allocatable"><CompactKvTable rows={Object.entries(asRecord(status.allocatable)).map(([label, value]) => ({ label, value }))} /></SectionCard>
      </div>
      <SectionCard title="Conditions"><DetailValue value={status.conditions} /></SectionCard>
      <SectionCard title="Addresses"><DetailValue value={status.addresses} /></SectionCard>
    </div>
  )
}

function StructuredResourceOverview({ resource, sections }: { resource: KubeResource; sections: DetailSection[] }) {
  const spec = asRecord(resource.spec)
  const status = asRecord(resource.status)
  const topSpec = Object.entries(spec).filter(([, value]) => hasRenderableValue(value)).slice(0, 12).map(([label, value]) => ({ label, value }))
  const topStatus = Object.entries(status).filter(([, value]) => hasRenderableValue(value)).slice(0, 12).map(([label, value]) => ({ label, value }))
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Kind" value={resource.kind} />
        <SummaryCard label="API Version" value={resource.apiVersion} />
        <SummaryCard label="Status" value={getValue(resource, ["status", "phase"]) ?? getValue(resource, ["status", "conditions", "0", "type"]) ?? "Active"} />
        <SummaryCard label="Created" value={resource.metadata.creationTimestamp} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Spec"><CompactKvTable rows={topSpec} /></SectionCard>
        <SectionCard title="Status"><CompactKvTable rows={topStatus} /></SectionCard>
      </div>
      {sections.filter((section) => !["Metadata", "Status"].includes(section.title)).map((section) => (
        <SectionCard key={section.title} title={section.title} description={section.description}>
          <CompactKvTable rows={section.items.map((item) => ({ label: item.label, value: item.value }))} />
        </SectionCard>
      ))}
    </div>
  )
}

function ResourceSpecificOverview({ resource, config, sections }: { resource: KubeResource; config: ResourceConfig; sections: DetailSection[] }) {
  const kind = resource.kind || config.kind
  const id = config.id
  if (kind === "Pod") return <PodDetailOverview resource={resource} />
  if (["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Job", "CronJob", "HorizontalPodAutoscaler", "VirtualMachinePool", "VirtualMachineInstanceReplicaSet"].includes(kind)) return <WorkloadDetailOverview resource={resource} />
  if (kind === "Node") return <NodeDetailOverview resource={resource} />
  if (["Service", "Ingress", "IngressClass", "NetworkPolicy", "EndpointSlice", "Endpoints", "NetworkAttachmentDefinition", "Gateway", "GatewayClass", "HTTPRoute"].includes(kind) || id.toLowerCase().includes("network") || id.toLowerCase().includes("route") || id.toLowerCase().includes("gateway") || id.toLowerCase().includes("cilium") || id.toLowerCase().includes("calico") || id.toLowerCase().includes("kubeovn")) return <NetworkDetailOverview resource={resource} />
  if (["PersistentVolume", "PersistentVolumeClaim", "StorageClass", "CSIDriver", "CSINode", "CSIStorageCapacity", "VolumeAttachment", "VolumeSnapshot", "VolumeSnapshotClass", "VolumeSnapshotContent", "DataVolume", "DataSource", "StorageProfile"].includes(kind) || id.toLowerCase().includes("volume") || id.toLowerCase().includes("storage") || id.toLowerCase().includes("snapshot")) return <StorageDetailOverview resource={resource} />
  if (kind.includes("VirtualMachine") || kind === "KubeVirt" || kind.startsWith("CDI") || ["ObjectTransfer", "DataImportCron", "VolumeImportSource", "VolumeUploadSource", "VolumeCloneSource"].includes(kind)) return <VirtualizationDetailOverview resource={resource} />
  return <StructuredResourceOverview resource={resource} sections={sections} />
}

const fieldDefaults = (fields?: CreateFormField[]) =>
  Object.fromEntries((fields || []).map((field) => [field.name, typeof field.defaultValue === "function" ? "" : field.defaultValue ?? ""])) as Record<string, string | boolean>

const resourceFieldDefaults = (resource: KubeResource, fields?: CreateFormField[]) =>
  Object.fromEntries((fields || []).map((field) => [
    field.name,
    typeof field.defaultValue === "function" ? field.defaultValue(resource) : field.defaultValue ?? "",
  ])) as Record<string, string | boolean>

const templateResource = (config: ResourceConfig, values: Record<string, string | boolean>) => {
  const parsed = YAML.load(config.createTemplate) as KubeResource
  parsed.metadata = parsed.metadata || { name: "" }
  if (values.name) parsed.metadata.name = String(values.name)
  if (config.namespaced && values.namespace) parsed.metadata.namespace = String(values.namespace)
  return parsed
}

const groupFields = (fields?: CreateFormField[]) => {
  const groups = new Map<string, CreateFormField[]>()
  ;(fields || []).forEach((field) => {
    const section = field.section || "General"
    groups.set(section, [...(groups.get(section) || []), field])
  })
  return Array.from(groups.entries()).map(([section, items]) => ({ section, items }))
}

function FormField({ field, value, onChange }: { field: CreateFormField; value: string | boolean; onChange: (value: string | boolean) => void }) {
  const id = `create-${field.name}`
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{field.label}{field.required && <span className="text-destructive"> *</span>}</span>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="min-h-24 rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.type === "checkbox" ? (
        <div className="flex h-9 items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-muted-foreground">{field.placeholder || "Enabled"}</span>
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.description && <span className="text-xs text-muted-foreground">{field.description}</span>}
    </label>
  )
}

export function ResourceCreateDialog({ config, onCreated }: { config: ResourceConfig; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string | boolean>>(() => fieldDefaults(config.createFields))
  const [content, setContent] = useState("")
  const [advanced, setAdvanced] = useState(false)
  const [yamlEdited, setYamlEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const previewResource = useMemo(
    () => config.buildCreateResource ? config.buildCreateResource(values) : templateResource(config, values),
    [config, values]
  )
  const fieldGroups = useMemo(() => groupFields(config.createFields), [config.createFields])

  useEffect(() => {
    if (!yamlEdited) {
      const resources = Array.isArray(previewResource) ? previewResource : [previewResource]
      setContent(resources.map((resource) => YAML.dump(resource, { noRefs: true, lineWidth: 120 })).join("---\n"))
    }
  }, [previewResource, yamlEdited])

  useEffect(() => {
    if (!open) {
      setValues(fieldDefaults(config.createFields))
      setAdvanced(false)
      setYamlEdited(false)
      setError("")
    }
  }, [config.createFields, open])

  const createResource = async () => {
    setSaving(true)
    setError("")
    try {
      const parsed = YAML.loadAll(content).filter(Boolean) as KubeResource[]
      if (parsed.length === 0) throw new Error("at least one resource is required")

      for (const resource of parsed) {
        if (!resource?.metadata?.name) throw new Error("metadata.name is required")
        if (config.namespaced && !resource.metadata.namespace) throw new Error("metadata.namespace is required")

        if (config.createResourcePath) {
          const res = await apiFetch(config.createResourcePath(resource), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(resource),
          })
          if (!res.ok) throw new Error(`${resource.kind || "Resource"} ${resource.metadata.name}: ${await res.text()}`)
          continue
        }

        let created = false
        let lastError = ""
        for (const path of await servedPaths(config)) {
          const nextResource = { ...resource, apiVersion: path.apiVersion || resource.apiVersion }
          const res = await apiFetch(createPathUrl(config, path.resourcePath, resource), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(nextResource),
          })
          if (res.ok) {
            created = true
            break
          }
          lastError = await res.text()
          if (res.status !== 404) break
        }
        if (!created) throw new Error(`${resource.kind || "Resource"} ${resource.metadata.name}: ${lastError || "Resource API is not served by this cluster"}`)
      }
      setOpen(false)
      setValues(fieldDefaults(config.createFields))
      setYamlEdited(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create resource")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <FilePlus2 className="h-4 w-4" />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Create {config.kind}</DialogTitle>
          <DialogDescription>Fill the resource fields, review the generated YAML, then submit it to the current cluster context.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            {fieldGroups.map((group) => (
              <div key={group.section} className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 text-sm font-semibold text-foreground">{group.section}</div>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.items.map((field) => (
                    <div key={field.name} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                      <FormField
                        field={field}
                        value={values[field.name] ?? ""}
                        onChange={(next) => {
                          setValues((current) => ({ ...current, [field.name]: next }))
                          setYamlEdited(false)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="min-h-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">YAML Preview</div>
                <div className="text-xs text-muted-foreground">{advanced ? "Advanced editing enabled" : "Generated from the form"}</div>
              </div>
              <Button
                type="button"
                variant={advanced ? "default" : "outline"}
                size="sm"
                onClick={() => setAdvanced((current) => !current)}
              >
                Advanced
              </Button>
            </div>
            <textarea
              value={content}
              readOnly={!advanced}
              onChange={(e) => {
                setContent(e.target.value)
                setYamlEdited(true)
              }}
              className={cn(
                "h-[65vh] min-h-[360px] w-full rounded-lg border bg-muted/30 p-4 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !advanced && "cursor-default"
              )}
              spellCheck={false}
            />
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <span className="break-words">{error}</span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={createResource} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function requestPreview(action: ResourceAction, resource: KubeResource, values: Record<string, string | boolean>) {
  try {
    const request = action.buildRequest(resource, values)
    return YAML.dump({
      url: request.url,
      method: request.options?.method || "GET",
      headers: request.options?.headers,
      body: typeof request.options?.body === "string" ? YAML.load(request.options.body) || request.options.body : request.options?.body,
    }, { noRefs: true, lineWidth: 120 })
  } catch (err) {
    return err instanceof Error ? err.message : "Unable to preview request"
  }
}

function ResourceActionDialog({ action, resource, onComplete }: { action: ResourceAction; resource: KubeResource; onComplete: (navigateTo?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string | boolean>>(() => resourceFieldDefaults(resource, action.fields))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) setValues(resourceFieldDefaults(resource, action.fields))
    else setError("")
  }, [action.fields, open, resource])

  const preview = useMemo(() => requestPreview(action, resource, values), [action, resource, values])

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const request = action.buildRequest(resource, values)
      const res = await apiFetch(request.url, request.options || {})
      if (!res.ok) throw new Error(await res.text())
      setOpen(false)
      onComplete(request.navigateTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action.label.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={action.variant || "outline"}>{action.label}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{action.label} {resource.kind || "Resource"}</DialogTitle>
          {action.description && <DialogDescription>{action.description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            {(action.fields || []).length > 0 ? (action.fields || []).map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={values[field.name] ?? ""}
                onChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))}
              />
            )) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                This action will update the current resource.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">Request Preview</div>
            <pre className="min-h-[220px] overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs text-foreground whitespace-pre">
              {preview}
            </pre>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <span className="break-words">{error}</span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={action.variant === "destructive" ? "destructive" : "default"} onClick={submit} disabled={saving}>
            {saving ? "Applying..." : action.confirmLabel || action.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ResourceList({ config }: { config: ResourceConfig }) {
  const [items, setItems] = useState<KubeResource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      let loaded = false
      let lastError = ""
      const paths = await servedPaths(config)
      for (const path of paths) {
        const res = await apiFetch(path.listPath)
        if (res.ok) {
          const data = await res.json()
          setItems(data.items || [])
          loaded = true
          break
        }
        lastError = await res.text()
        if (res.status !== 404) break
      }
      if (!loaded) throw new Error(lastError || "Resource API is not served by this cluster")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [config.id])

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    return items.filter((item) => {
      const ns = item.metadata.namespace || ""
      return item.metadata.name.toLowerCase().includes(needle) || ns.toLowerCase().includes(needle)
    })
  }, [items, search])

  const emptyTitle = search ? "No matching resources" : `No ${config.title.toLowerCase()} found`
  const emptyDescription = search
    ? "Clear or change the search text to see other resources."
    : "This API returned an empty list for the current cluster context."
  const tableColumnCount = 5 + (config.namespaced ? 1 : 0) + (config.extraColumns?.length || 0)
  const selectedCount = Object.values(selected).filter(Boolean).length

  const remove = async (item: KubeResource) => {
    for (const path of await servedPaths(config)) {
      const res = await apiFetch(resourcePathUrl(config, path.resourcePath, item.metadata.name, item.metadata.namespace), { method: "DELETE" })
      if (res.ok) {
        load()
        return
      }
      if (res.status !== 404) return
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{config.title}</h1>
            {!loading && <Badge variant="outline">{items.length} total</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2 text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            Watch
          </Button>
          <Button size="sm" variant="outline" onClick={load} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          {selectedCount > 0 && (
            <Badge variant="outline">{selectedCount} selected</Badge>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={`Search ${config.title.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {config.allowCreate !== false && <ResourceCreateDialog config={config} onCreated={load} />}
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <div className="font-semibold">Resource API unavailable</div>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="max-h-[calc(100dvh-260px)] overflow-auto">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border accent-primary"
                    checked={filtered.length > 0 && filtered.every((item) => selected[item.metadata.uid || item.metadata.name])}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setSelected((current) => {
                        const next = { ...current }
                        filtered.forEach((item) => {
                          next[item.metadata.uid || item.metadata.name] = checked
                        })
                        return next
                      })
                    }}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold">Name</TableHead>
                {config.namespaced && <TableHead className="h-9 px-3 text-xs font-semibold">Namespace</TableHead>}
                <TableHead className="h-9 px-3 text-xs font-semibold">Status</TableHead>
                {config.extraColumns?.map((column) => <TableHead key={column.label} className="h-9 px-3 text-xs font-semibold">{column.label}</TableHead>)}
                <TableHead className="h-9 px-3 text-right text-xs font-semibold">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount}>
                    <div className="flex h-32 items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="h-56">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{emptyTitle}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
                      </div>
                      {config.allowCreate !== false && !search && <ResourceCreateDialog config={config} onCreated={load} />}
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((item) => {
                const rowKey = item.metadata.uid || `${item.metadata.namespace || "_cluster"}-${item.metadata.name}`
                return (
                <TableRow key={rowKey} className="hover:bg-muted/50">
                  <TableCell className="h-9 px-3 py-1.5">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border accent-primary"
                      checked={Boolean(selected[rowKey])}
                      onChange={(event) => setSelected((current) => ({ ...current, [rowKey]: event.target.checked }))}
                      aria-label={`Select ${item.metadata.name}`}
                    />
                  </TableCell>
                  <TableCell className="h-9 px-3 py-1.5">
                    <Link
                      to={`${config.path}/${item.metadata.namespace || "_cluster"}/${item.metadata.name}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {item.metadata.name}
                    </Link>
                  </TableCell>
                  {config.namespaced && <TableCell className="h-9 px-3 py-1.5 text-sm text-muted-foreground">{item.metadata.namespace}</TableCell>}
                  <TableCell className="h-9 px-3 py-1.5"><ResourceStatus resource={item} config={config} /></TableCell>
                  {config.extraColumns?.map((column) => (
                    <TableCell key={column.label} className="h-9 px-3 py-1.5 text-sm text-muted-foreground">{column.value(item) || "N/A"}</TableCell>
                  ))}
                  <TableCell className="h-9 px-3 py-1.5 text-right text-sm text-muted-foreground tabular-nums">
                    {item.metadata.creationTimestamp || "N/A"}
                  </TableCell>
                  <TableCell className="h-9 px-3 py-1.5">
                    {config.allowDelete !== false && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => remove(item)}
                        title="Delete resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export function ResourceDetail({ config }: { config: ResourceConfig }) {
  const { namespace, name } = useParams()
  const navigate = useNavigate()
  const [resource, setResource] = useState<KubeResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        let loaded = false
        let lastError = ""
        for (const path of await servedPaths(config)) {
          const res = await apiFetch(resourcePathUrl(config, path.resourcePath, name!, namespace))
          if (res.ok) {
            setResource(await res.json())
            loaded = true
            break
          }
          lastError = await res.text()
          if (res.status !== 404) break
        }
        if (!loaded) throw new Error(lastError || "Resource API is not served by this cluster")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load resource")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [config, name, namespace])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {error || "Resource not found"}
      </div>
    )
  }

  const labels = Object.entries(resource.metadata.labels || {})
  const annotations = Object.entries(resource.metadata.annotations || {})
  const reload = (navigateTo?: string) => {
    if (navigateTo) {
      navigate(navigateTo)
      return
    }
    setLoading(true)
    servedPaths(config)
      .then(async (paths) => {
        let lastError = ""
        for (const path of paths) {
          const res = await apiFetch(resourcePathUrl(config, path.resourcePath, name!, namespace))
          if (res.ok) {
            setResource(await res.json())
            return
          }
          lastError = await res.text()
          if (res.status !== 404) break
        }
        throw new Error(lastError || "Resource API is not served by this cluster")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resource"))
      .finally(() => setLoading(false))
  }

  const sections = [
    ...defaultDetailSections(resource),
    ...(config.detailSections ? config.detailSections(resource) : []),
  ].filter((section) => section.items.length > 0)
  const relatedPods = relatedPodsForResource(resource)

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(config.path)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{resource.metadata.name}</h1>
            <ResourceStatus resource={resource} config={config} />
          </div>
          <p className="text-sm text-muted-foreground">{resource.metadata.namespace || "cluster scoped"}</p>
        </div>
        {config.actions && config.actions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {config.actions.map((action) => (
              <ResourceActionDialog key={action.id} action={action} resource={resource} onComplete={reload} />
            ))}
          </div>
        )}
      </div>

      <DetailTabs config={config} namespace={namespace} name={name} active="overview" />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Kind</CardDescription>
            <CardTitle className="text-sm font-semibold">{resource.kind || config.kind}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>API Version</CardDescription>
            <CardTitle className="text-sm font-semibold">{resource.apiVersion || "N/A"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Created</CardDescription>
            <CardTitle className="text-sm font-semibold">
              {resource.metadata.creationTimestamp || "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <ResourceSpecificOverview resource={resource} config={config} sections={sections} />

      {relatedPods && (
        <RelatedPodsCard
          title={relatedPods.title}
          namespace={relatedPods.namespace}
          selector={relatedPods.selector}
          selectors={relatedPods.selectors}
          podName={relatedPods.podName}
          pods={relatedPods.pods}
        />
      )}

      {(labels.length > 0 || annotations.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Labels</div>
              <div className="flex flex-wrap gap-2">
                {labels.map(([key, value]) => (
                  <span key={key} className="rounded-md border bg-muted px-2 py-1 text-xs text-foreground">
                    {key}: {value}
                  </span>
                ))}
                {labels.length === 0 && <span className="text-sm text-muted-foreground">No labels</span>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Annotations</div>
              <div className="grid gap-2">
                {annotations.slice(0, 8).map(([key, value]) => (
                  <div key={key} className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{key}</div>
                    <div className="mt-1 break-words text-muted-foreground">{value}</div>
                  </div>
                ))}
                {annotations.length === 0 && <span className="text-sm text-muted-foreground">No annotations</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function ResourceManifest({ config }: { config: ResourceConfig }) {
  const { namespace, name } = useParams()
  const navigate = useNavigate()
  const [resource, setResource] = useState<KubeResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      let loaded = false
      let lastError = ""
      for (const path of await servedPaths(config)) {
        const res = await apiFetch(resourcePathUrl(config, path.resourcePath, name!, namespace))
        if (res.ok) {
          setResource(await res.json())
          loaded = true
          break
        }
        lastError = await res.text()
        if (res.status !== 404) break
      }
      if (!loaded) throw new Error(lastError || "Resource API is not served by this cluster")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manifest")
      setResource(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [config, name, namespace])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  const yaml = resource ? YAML.dump(resource, { noRefs: true, lineWidth: 120 }) : ""

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${config.path}/${namespace || "_cluster"}/${name}`)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="text-sm text-muted-foreground">Manifest</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <DetailTabs config={config} namespace={namespace} name={name} active="manifest" />

      {error ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <div className="font-semibold">Manifest unavailable</div>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <pre className="min-h-[calc(100dvh-260px)] overflow-x-auto rounded-lg bg-muted/30 p-6 font-mono text-sm text-foreground whitespace-pre">
              {yaml}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
