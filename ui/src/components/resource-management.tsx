import { useEffect, useMemo, useState } from "react"
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

type KubeResource = {
  apiVersion?: string
  kind?: string
  metadata: {
    name: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
  }
  spec?: Record<string, unknown>
  status?: Record<string, unknown>
  [key: string]: unknown
}

export type CreateFormField = {
  name: string
  label: string
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
  items: Array<{ label: string; value: unknown }>
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
  namespaced: boolean
  resourcePath: string
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
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const defaultDetailSections = (resource: KubeResource): DetailSection[] => [
  {
    title: "Metadata",
    items: [
      { label: "Name", value: resource.metadata.name },
      { label: "Namespace", value: resource.metadata.namespace || "cluster scoped" },
      { label: "Created", value: resource.metadata.creationTimestamp ? new Date(resource.metadata.creationTimestamp).toLocaleString() : "N/A" },
      { label: "UID", value: resource.metadata.uid },
    ],
  },
  {
    title: "Status",
    items: Object.entries(resource.status || {}).slice(0, 8).map(([label, value]) => ({ label, value })),
  },
]

function ResourceStatus({ resource, config }: { resource: KubeResource; config: ResourceConfig }) {
  const value =
    getValue(resource, config.statusPath) ??
    getValue(resource, ["status", "phase"]) ??
    getValue(resource, ["status", "conditions", "0", "type"]) ??
    "Active"

  return <Badge variant={statusVariant(String(value))}>{String(value)}</Badge>
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

        const basePath = config.createResourcePath
          ? config.createResourcePath(resource)
          : config.namespaced
            ? `${config.resourcePath}/namespaces/${resource.metadata.namespace}/${config.id}`
            : `${config.resourcePath}/${config.id}`

        const res = await apiFetch(basePath, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(resource),
        })
        if (!res.ok) throw new Error(`${resource.kind || "Resource"} ${resource.metadata.name}: ${await res.text()}`)
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
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create {config.kind}</DialogTitle>
          <DialogDescription>Fill the resource fields, review the generated YAML, then submit it to the current cluster context.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {(config.createFields || []).map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={values[field.name] ?? ""}
                onChange={(next) => {
                  setValues((current) => ({ ...current, [field.name]: next }))
                  setYamlEdited(false)
                }}
              />
            ))}
          </div>
          <div className="space-y-3">
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
                "min-h-[420px] w-full rounded-lg border bg-muted/30 p-4 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(config.listPath)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.items || [])
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

  const remove = async (item: KubeResource) => {
    const nsPath = config.namespaced ? `/namespaces/${item.metadata.namespace}` : ""
    const res = await apiFetch(`${config.resourcePath}${nsPath}/${config.id}/${item.metadata.name}`, { method: "DELETE" })
    if (res.ok) load()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{config.title}</h1>
            {!loading && <Badge variant="outline">{items.length} total</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {config.allowCreate !== false && <ResourceCreateDialog config={config} onCreated={load} />}
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={`Search ${config.title.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
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

      <Card className="p-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {config.namespaced && <TableHead>Namespace</TableHead>}
                <TableHead>Status</TableHead>
                {config.extraColumns?.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5 + (config.extraColumns?.length || 0)}>
                    <div className="flex h-32 items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5 + (config.extraColumns?.length || 0)} className="h-56">
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
              ) : filtered.map((item) => (
                <TableRow key={item.metadata.uid || `${item.metadata.namespace || "_cluster"}-${item.metadata.name}`} className="hover:bg-muted/50">
                  <TableCell>
                    <Link
                      to={`${config.path}/${item.metadata.namespace || "_cluster"}/${item.metadata.name}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {item.metadata.name}
                    </Link>
                  </TableCell>
                  {config.namespaced && <TableCell className="text-muted-foreground text-sm">{item.metadata.namespace}</TableCell>}
                  <TableCell><ResourceStatus resource={item} config={config} /></TableCell>
                  {config.extraColumns?.map((column) => (
                    <TableCell key={column.label} className="text-muted-foreground text-sm">{column.value(item) || "N/A"}</TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                    {item.metadata.creationTimestamp ? new Date(item.metadata.creationTimestamp).toLocaleDateString() : "N/A"}
                  </TableCell>
                  <TableCell>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
        const nsPath = config.namespaced ? `/namespaces/${namespace}` : ""
        const res = await apiFetch(`${config.resourcePath}${nsPath}/${config.id}/${name}`)
        if (!res.ok) throw new Error(await res.text())
        setResource(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load resource")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [config.id, config.namespaced, config.resourcePath, name, namespace])

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

  const yaml = YAML.dump(resource, { noRefs: true, lineWidth: 120 })
  const labels = Object.entries(resource.metadata.labels || {})
  const reload = (navigateTo?: string) => {
    if (navigateTo) {
      navigate(navigateTo)
      return
    }
    setLoading(true)
    const nsPath = config.namespaced ? `/namespaces/${namespace}` : ""
    apiFetch(`${config.resourcePath}${nsPath}/${config.id}/${name}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        setResource(await res.json())
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resource"))
      .finally(() => setLoading(false))
  }

  const sections = [
    ...defaultDetailSections(resource),
    ...(config.detailSections ? config.detailSections(resource) : []),
  ].filter((section) => section.items.length > 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Kind</CardDescription>
            <CardTitle className="text-sm font-semibold">{resource.kind || config.kind}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>API Version</CardDescription>
            <CardTitle className="text-sm font-semibold">{resource.apiVersion || "N/A"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Created</CardDescription>
            <CardTitle className="text-sm font-semibold">
              {resource.metadata.creationTimestamp ? new Date(resource.metadata.creationTimestamp).toLocaleString() : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-sm">{section.title}</CardTitle>
              {section.description && <CardDescription>{section.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                {section.items.map((item) => (
                  <div key={item.label} className="grid gap-1 rounded-lg border bg-muted/30 p-3">
                    <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                    <dd className="break-words text-sm text-foreground">{compactValue(item.value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {labels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              Labels
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {labels.map(([key, value]) => (
              <span key={key} className="rounded-md border bg-muted px-2 py-1 text-xs text-foreground">
                {key}: {value}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Raw Manifest</CardTitle>
          <CardDescription>Full Kubernetes object for advanced inspection.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <pre className={cn("min-h-[400px] overflow-x-auto rounded-lg bg-muted/30 p-6 font-mono text-sm text-foreground whitespace-pre")}>
            {yaml}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
