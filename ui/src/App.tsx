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
import { ResourceCreateDialog, ResourceDetail, ResourceList, ResourceManifest, type CreateFormField, type ResourceAction, type ResourceConfig } from "./components/resource-management";
import { SiteHeader } from "./components/site-header";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card as ShadCard, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
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

const namespaceNameFields = (name: string, namespace = "default"): CreateFormField[] => [
  { name: "name", label: "Name", section: "Identity", defaultValue: name, required: true },
  { name: "namespace", label: "Namespace", section: "Identity", defaultValue: namespace, required: true },
];

const nameOnlyFields = (name: string): CreateFormField[] => [
  { name: "name", label: "Name", section: "Identity", defaultValue: name, required: true },
];

const numberValue = (value: string | boolean, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const stringValue = (value: string | boolean | undefined, fallback = "") => {
  const next = String(value ?? "").trim();
  return next || fallback;
};

const getRecord = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {});
const listNames = (value: unknown) => Array.isArray(value) ? value.map((item) => item?.name || item?.metadata?.name || JSON.stringify(item)).join(", ") : "";
const selectorText = (value: unknown) => Object.entries(getRecord(value)).map(([key, val]) => `${key}=${val}`).join(", ");
const keyValueText = (value?: Record<string, string>) => Object.entries(value || {}).map(([key, val]) => `${key}=${val}`).join("\n");
const parseKeyValueText = (text: string) => Object.fromEntries(
  text.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim()];
    })
    .filter(([key]) => key)
);
const selectorFromValues = (values: Record<string, string | boolean>, keyName = "selectorKey", valueName = "selectorValue") => ({
  matchLabels: { [stringValue(values[keyName], "app")]: stringValue(values[valueName], "default") },
});
const mergePatch = (body: unknown): RequestInit => ({
  method: "PATCH",
  headers: { "Content-Type": "application/merge-patch+json", Accept: "application/json" },
  body: JSON.stringify(body),
});
const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(body),
});
const jsonPut = (body: unknown = {}): RequestInit => ({
  method: "PUT",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(body),
});
const resourceRefPath = (base: string, id: string, resource: { metadata: { namespace?: string; name: string } }) =>
  `${base}${resource.metadata.namespace ? `/namespaces/${resource.metadata.namespace}` : ""}/${id}/${resource.metadata.name}`;

const poolActions: ResourceAction[] = [
  {
    id: "start-pool",
    label: "Start",
    description: "Set the pool VM template run strategy to Always.",
    buildRequest: (resource) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({ spec: { virtualMachineTemplate: { spec: { runStrategy: "Always" } } } }),
    }),
  },
  {
    id: "stop-pool",
    label: "Stop",
    description: "Set the pool VM template run strategy to Halted.",
    buildRequest: (resource) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({ spec: { virtualMachineTemplate: { spec: { runStrategy: "Halted" } } } }),
    }),
  },
  {
    id: "scale-pool",
    label: "Scale",
    fields: [{ name: "replicas", label: "Replicas", type: "number", defaultValue: (r) => String(getRecord(r.spec).replicas || 1) }],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({ spec: { replicas: numberValue(values.replicas, 1) } }),
    }),
  },
  {
    id: "resize-pool",
    label: "Resize",
    fields: [
      { name: "sockets", label: "Sockets", type: "number", defaultValue: "1" },
      { name: "cores", label: "Cores", type: "number", defaultValue: "1" },
      { name: "threads", label: "Threads", type: "number", defaultValue: "1" },
      { name: "memory", label: "Memory", defaultValue: "1Gi" },
    ],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({
        spec: {
          virtualMachineTemplate: {
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
          },
        },
      }),
    }),
  },
  {
    id: "pool-run-strategy",
    label: "Run Strategy",
    fields: [{ name: "runStrategy", label: "Run Strategy", type: "select", defaultValue: "Always", options: [{ label: "Always", value: "Always" }, { label: "Halted", value: "Halted" }, { label: "Manual", value: "Manual" }] }],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({ spec: { virtualMachineTemplate: { spec: { runStrategy: stringValue(values.runStrategy, "Always") } } } }),
    }),
  },
  {
    id: "pool-instance-type",
    label: "Instance Type",
    fields: [{ name: "instanceType", label: "Cluster Instance Type", defaultValue: "" }],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({ spec: { virtualMachineTemplate: { spec: { instancetype: { name: stringValue(values.instanceType) } } } } }),
    }),
  },
  {
    id: "pool-priority-class",
    label: "Priority Class",
    fields: [{ name: "priorityClassName", label: "Priority Class Name", defaultValue: "" }],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
      options: mergePatch({ spec: { virtualMachineTemplate: { spec: { template: { spec: { priorityClassName: stringValue(values.priorityClassName) } } } } } }),
    }),
  },
  {
    id: "detach-vm",
    label: "Detach VM",
    description: "Remove pool ownership labels from a VM and pin it to a selected node.",
    fields: [
      { name: "vmName", label: "VM Name", defaultValue: "" },
      { name: "nodeName", label: "Target Node", defaultValue: "" },
    ],
    buildRequest: (resource, values) => {
      const vmName = stringValue(values.vmName);
      return {
        url: `/apis/kubevirt.io/v1/namespaces/${resource.metadata.namespace}/virtualmachines/${vmName}`,
        options: mergePatch({
          metadata: {
            labels: {
              "kubevirt.io/domain": vmName,
              "kubevirt.io/vm-pool-revision-name": null,
              "kubevirt.io/vmpool": null,
            },
            ownerReferences: null,
          },
          spec: {
            template: {
              metadata: {
                labels: {
                  "kubevirt.io/domain": vmName,
                  "kubevirt.io/vm-pool-revision-name": null,
                  "kubevirt.io/vmpool": null,
                },
              },
              spec: { nodeSelector: { "kubernetes.io/hostname": stringValue(values.nodeName) } },
            },
          },
        }),
      };
    },
  },
  {
    id: "set-liveness",
    label: "Liveness Probe",
    description: "Set or clear the VM template livenessProbe. Enter JSON for the probe, or leave empty to clear it.",
    fields: [{ name: "probe", label: "Probe JSON", type: "textarea", defaultValue: "" }],
    buildRequest: (resource, values) => {
      const probe = stringValue(values.probe);
      return {
        url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
        options: mergePatch({ spec: { virtualMachineTemplate: { spec: { template: { spec: { livenessProbe: probe ? JSON.parse(probe) : null } } } } } }),
      };
    },
  },
  {
    id: "set-readiness",
    label: "Readiness Probe",
    description: "Set or clear the VM template readinessProbe. Enter JSON for the probe, or leave empty to clear it.",
    fields: [{ name: "probe", label: "Probe JSON", type: "textarea", defaultValue: "" }],
    buildRequest: (resource, values) => {
      const probe = stringValue(values.probe);
      return {
        url: resourceRefPath("/apis/pool.kubevirt.io/v1alpha1", "virtualmachinepools", resource),
        options: mergePatch({ spec: { virtualMachineTemplate: { spec: { template: { spec: { readinessProbe: probe ? JSON.parse(probe) : null } } } } } }),
      };
    },
  },
];

const serviceActions: ResourceAction[] = [
  {
    id: "service-type",
    label: "Change Type",
    fields: [{ name: "type", label: "Service Type", type: "select", defaultValue: (r) => String(getRecord(r.spec).type || "ClusterIP"), options: [{ label: "ClusterIP", value: "ClusterIP" }, { label: "NodePort", value: "NodePort" }, { label: "LoadBalancer", value: "LoadBalancer" }] }],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/api/v1", "services", resource),
      options: mergePatch({ spec: { type: stringValue(values.type, "ClusterIP") } }),
    }),
  },
];

const instanceTypeActions: ResourceAction[] = [
  {
    id: "edit-shape",
    label: "Edit Shape",
    fields: [
      { name: "cpu", label: "Guest CPUs", type: "number", defaultValue: (r) => String(getRecord(getRecord(r.spec).cpu).guest || 1) },
      { name: "memory", label: "Guest Memory", defaultValue: (r) => String(getRecord(getRecord(r.spec).memory).guest || "1Gi") },
    ],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/instancetype.kubevirt.io/v1beta1", "virtualmachineclusterinstancetypes", resource),
      options: mergePatch({ spec: { cpu: { guest: numberValue(values.cpu, 1) }, memory: { guest: stringValue(values.memory, "1Gi") } } }),
    }),
  },
];

const hpaActions: ResourceAction[] = [
  {
    id: "scale-bounds",
    label: "Scale Bounds",
    fields: [
      { name: "minReplicas", label: "Min Replicas", type: "number", defaultValue: (r) => String(getRecord(r.spec).minReplicas || 1) },
      { name: "maxReplicas", label: "Max Replicas", type: "number", defaultValue: (r) => String(getRecord(r.spec).maxReplicas || 3) },
      { name: "cpu", label: "CPU Utilization", type: "number", defaultValue: "80" },
    ],
    buildRequest: (resource, values) => ({
      url: resourceRefPath("/apis/autoscaling/v2", "horizontalpodautoscalers", resource),
      options: mergePatch({
        spec: {
          minReplicas: numberValue(values.minReplicas, 1),
          maxReplicas: numberValue(values.maxReplicas, 3),
          metrics: [{ type: "Resource", resource: { name: "cpu", target: { type: "Utilization", averageUtilization: numberValue(values.cpu, 80) } } }],
        },
      }),
    }),
  },
];

const networkPolicyActions: ResourceAction[] = [
  {
    id: "set-rules",
    label: "Set Rules",
    description: "Replace simple ingress/egress rules using optional CIDR and TCP ports.",
    fields: [
      { name: "policyType", label: "Policy Type", type: "select", defaultValue: "Ingress", options: [{ label: "Ingress", value: "Ingress" }, { label: "Egress", value: "Egress" }, { label: "Ingress and Egress", value: "Both" }] },
      { name: "ingressPort", label: "Ingress TCP Port", defaultValue: "", placeholder: "optional" },
      { name: "ingressCidr", label: "Ingress CIDR", defaultValue: "", placeholder: "0.0.0.0/0" },
      { name: "egressPort", label: "Egress TCP Port", defaultValue: "", placeholder: "optional" },
      { name: "egressCidr", label: "Egress CIDR", defaultValue: "", placeholder: "0.0.0.0/0" },
    ],
    buildRequest: (resource, values) => {
      const policyType = stringValue(values.policyType, "Ingress");
      const policyTypes = policyType === "Both" ? ["Ingress", "Egress"] : [policyType];
      const ingressPort = stringValue(values.ingressPort);
      const egressPort = stringValue(values.egressPort);
      const ingressCidr = stringValue(values.ingressCidr);
      const egressCidr = stringValue(values.egressCidr);
      return {
        url: resourceRefPath("/apis/networking.k8s.io/v1", "networkpolicies", resource),
        options: mergePatch({
          spec: {
            policyTypes,
            ...(policyTypes.includes("Ingress") ? {
              ingress: [{
                ...(ingressCidr ? { from: [{ ipBlock: { cidr: ingressCidr } }] } : {}),
                ...(ingressPort ? { ports: [{ protocol: "TCP", port: numberValue(ingressPort, 1) }] } : {}),
              }],
            } : { ingress: null }),
            ...(policyTypes.includes("Egress") ? {
              egress: [{
                ...(egressCidr ? { to: [{ ipBlock: { cidr: egressCidr } }] } : {}),
                ...(egressPort ? { ports: [{ protocol: "TCP", port: numberValue(egressPort, 1) }] } : {}),
              }],
            } : { egress: null }),
          },
        }),
      };
    },
  },
];

const csvList = (value: string | boolean | undefined) => stringValue(value).split(",").map((item) => item.trim()).filter(Boolean);

const kubeOvnResourceConfig = ({
  plural,
  path,
  title,
  subtitle,
  kind,
  namespaced = false,
  createFields = [],
  buildSpec,
  statusPath,
  extraColumns = [],
  allowCreate,
  allowDelete,
}: {
  plural: string;
  path: string;
  title: string;
  subtitle: string;
  kind: string;
  namespaced?: boolean;
  createFields?: CreateFormField[];
  buildSpec?: (values: Record<string, string | boolean>) => Record<string, unknown>;
  statusPath?: string[];
  extraColumns?: ResourceConfig["extraColumns"];
  allowCreate?: boolean;
  allowDelete?: boolean;
}): ResourceConfig => ({
  id: plural,
  path,
  title,
  subtitle,
  listPath: `/apis/kubeovn.io/v1/${plural}`,
  namespaced,
  resourcePath: "/apis/kubeovn.io/v1",
  kind,
  allowCreate,
  allowDelete,
  createFields: [
    ...(namespaced ? namespaceNameFields(`example-${plural}`) : nameOnlyFields(`example-${plural}`)),
    ...createFields,
  ],
  buildCreateResource: buildSpec ? (values) => ({
    apiVersion: "kubeovn.io/v1",
    kind,
    metadata: {
      name: stringValue(values.name, `example-${plural}`),
      ...(namespaced ? { namespace: stringValue(values.namespace, "default") } : {}),
    },
    spec: buildSpec(values),
  }) : undefined,
  statusPath,
  detailSections: (r) => {
    const spec = getRecord(r.spec);
    const status = getRecord(r.status);
    return [
      {
        title: kind,
        items: Object.entries(spec).map(([label, value]) => ({ label, value })),
      },
      {
        title: "Status",
        items: Object.entries(status).map(([label, value]) => ({ label, value })),
      },
    ].filter((section) => section.items.length > 0);
  },
  extraColumns,
  createTemplate: `apiVersion: kubeovn.io/v1
kind: ${kind}
metadata:
  name: example-${plural}
spec: {}
`,
});

const extensionResourceConfig = ({
  groupVersion,
  plural,
  path,
  title,
  subtitle,
  kind,
  namespaced = false,
  createFields = [],
  buildSpec,
  statusPath,
  extraColumns = [],
  allowCreate,
  allowDelete,
}: {
  groupVersion: string;
  plural: string;
  path: string;
  title: string;
  subtitle: string;
  kind: string;
  namespaced?: boolean;
  createFields?: CreateFormField[];
  buildSpec?: (values: Record<string, string | boolean>) => Record<string, unknown>;
  statusPath?: string[];
  extraColumns?: ResourceConfig["extraColumns"];
  allowCreate?: boolean;
  allowDelete?: boolean;
}): ResourceConfig => ({
  id: plural,
  path,
  title,
  subtitle,
  listPath: `/apis/${groupVersion}/${plural}`,
  namespaced,
  resourcePath: `/apis/${groupVersion}`,
  kind,
  allowCreate,
  allowDelete,
  createFields: [
    ...(namespaced ? namespaceNameFields(`example-${plural}`) : nameOnlyFields(`example-${plural}`)),
    ...createFields,
  ],
  buildCreateResource: buildSpec ? (values) => ({
    apiVersion: groupVersion,
    kind,
    metadata: {
      name: stringValue(values.name, `example-${plural}`),
      ...(namespaced ? { namespace: stringValue(values.namespace, "default") } : {}),
    },
    spec: buildSpec(values),
  }) : undefined,
  statusPath,
  detailSections: (r) => {
    const spec = getRecord(r.spec);
    const status = getRecord(r.status);
    return [
      { title: "Spec", items: Object.entries(spec).map(([label, value]) => ({ label, value })) },
      { title: "Status", items: Object.entries(status).map(([label, value]) => ({ label, value })) },
    ].filter((section) => section.items.length > 0);
  },
  extraColumns,
  createTemplate: `apiVersion: ${groupVersion}
kind: ${kind}
metadata:
  name: example-${plural}
spec: {}
`,
});

const calicoResourceConfig = (config: Omit<Parameters<typeof extensionResourceConfig>[0], "groupVersion">) =>
  extensionResourceConfig({ groupVersion: "projectcalico.org/v3", ...config });

const ciliumResourceConfig = (config: Omit<Parameters<typeof extensionResourceConfig>[0], "groupVersion"> & { version?: "v2" | "v2alpha1" }) => {
  const { version = "v2", ...rest } = config;
  return extensionResourceConfig({ groupVersion: `cilium.io/${version}`, ...rest });
};

export const vmCreateConfig: ResourceConfig = {
  id: "virtualmachines",
  path: "/vms",
  title: "Virtual Machines",
  subtitle: "Create a KubeVirt virtual machine",
  listPath: "/apis/kubevirt.io/v1/virtualmachines",
  namespaced: true,
  resourcePath: "/apis/kubevirt.io/v1",
  kind: "VirtualMachine",
  createTemplate: "",
  createFields: [
    ...namespaceNameFields("example-vm"),
    { name: "runStrategy", label: "Run Strategy", section: "Lifecycle", type: "select", defaultValue: "Halted", options: [{ label: "Halted", value: "Halted" }, { label: "Always", value: "Always" }, { label: "Manual", value: "Manual" }] },
    { name: "sockets", label: "CPU Sockets", section: "Compute", type: "number", defaultValue: "1" },
    { name: "cpu", label: "CPU Cores", section: "Compute", type: "number", defaultValue: "1" },
    { name: "threads", label: "CPU Threads", section: "Compute", type: "number", defaultValue: "1" },
    { name: "memory", label: "Memory", section: "Compute", defaultValue: "1Gi", placeholder: "1Gi" },
    { name: "instanceType", label: "Cluster Instance Type", section: "Compute", defaultValue: "", placeholder: "optional" },
    { name: "priorityClassName", label: "Priority Class", section: "Scheduling", defaultValue: "", placeholder: "optional" },
    { name: "machineType", label: "Machine Type", section: "Scheduling", defaultValue: "q35", placeholder: "q35" },
    { name: "networkMode", label: "Default Network Mode", section: "Network", type: "select", defaultValue: "masquerade", options: [{ label: "Masquerade", value: "masquerade" }, { label: "Bridge", value: "bridge" }, { label: "SR-IOV", value: "sriov" }] },
    { name: "diskBus", label: "Disk Bus", section: "Storage", type: "select", defaultValue: "virtio", options: [{ label: "virtio", value: "virtio" }, { label: "sata", value: "sata" }, { label: "scsi", value: "scsi" }] },
    { name: "containerImage", label: "Container Disk Image", section: "Storage", defaultValue: "quay.io/containerdisks/fedora:latest" },
    { name: "cloudInit", label: "Cloud-init User Data", section: "Initialization", type: "textarea", defaultValue: "#cloud-config\npassword: kubevirt\nchpasswd: { expire: False }\nssh_pwauth: True" },
    { name: "labels", label: "Labels", section: "Metadata", type: "textarea", defaultValue: "kubevirt-manager.io/managed=true", placeholder: "key=value per line" },
    { name: "annotations", label: "Annotations", section: "Metadata", type: "textarea", defaultValue: "", placeholder: "key=value per line" },
  ],
  buildCreateResource: (values) => {
    const name = stringValue(values.name, "example-vm");
    const labels = { ...parseKeyValueText(stringValue(values.labels)), "kubevirt.io/domain": name };
    const annotations = parseKeyValueText(stringValue(values.annotations));
    const networkMode = stringValue(values.networkMode, "masquerade");
    const priorityClassName = stringValue(values.priorityClassName);
    const instanceType = stringValue(values.instanceType);
    return {
      apiVersion: "kubevirt.io/v1",
      kind: "VirtualMachine",
      metadata: {
        name,
        namespace: stringValue(values.namespace, "default"),
        labels,
        ...(Object.keys(annotations).length ? { annotations } : {}),
      },
      spec: {
        runStrategy: stringValue(values.runStrategy, "Halted"),
        ...(instanceType ? { instancetype: { name: instanceType } } : {}),
        template: {
          metadata: { labels, ...(Object.keys(annotations).length ? { annotations } : {}) },
          spec: {
            ...(priorityClassName ? { priorityClassName } : {}),
            domain: {
              machine: { type: stringValue(values.machineType, "q35") },
              cpu: {
                sockets: numberValue(values.sockets, 1),
                cores: numberValue(values.cpu, 1),
                threads: numberValue(values.threads, 1),
              },
              resources: { requests: { memory: stringValue(values.memory, "1Gi") } },
              devices: {
                disks: [
                  { name: "containerdisk", disk: { bus: stringValue(values.diskBus, "virtio") } },
                  { name: "cloudinitdisk", disk: { bus: stringValue(values.diskBus, "virtio") } },
                ],
                interfaces: [{ name: "default", [networkMode]: {} }],
              },
            },
            networks: [{ name: "default", pod: {} }],
            volumes: [
              { name: "containerdisk", containerDisk: { image: stringValue(values.containerImage, "quay.io/containerdisks/fedora:latest") } },
              { name: "cloudinitdisk", cloudInitNoCloud: { userData: stringValue(values.cloudInit) } },
            ],
          },
        },
      },
    };
  },
};

export const dvCreateConfig: ResourceConfig = {
  id: "datavolumes",
  path: "/dvs",
  title: "DataVolumes",
  subtitle: "Create a CDI DataVolume",
  listPath: "/apis/cdi.kubevirt.io/v1beta1/datavolumes",
  namespaced: true,
  resourcePath: "/apis/cdi.kubevirt.io/v1beta1",
  kind: "DataVolume",
  createTemplate: "",
  createFields: [
    ...namespaceNameFields("example-disk"),
    { name: "storage", label: "Storage Size", section: "Storage", defaultValue: "10Gi" },
    { name: "accessMode", label: "Access Mode", section: "Storage", type: "select", defaultValue: "ReadWriteOnce", options: [{ label: "ReadWriteOnce", value: "ReadWriteOnce" }, { label: "ReadWriteMany", value: "ReadWriteMany" }] },
    { name: "volumeMode", label: "Volume Mode", section: "Storage", type: "select", defaultValue: "Filesystem", options: [{ label: "Filesystem", value: "Filesystem" }, { label: "Block", value: "Block" }] },
    { name: "storageClassName", label: "Storage Class", section: "Storage", defaultValue: "", placeholder: "optional" },
    { name: "sourceType", label: "Source", section: "Source", type: "select", defaultValue: "blank", options: [{ label: "Blank", value: "blank" }, { label: "HTTP Image", value: "http" }, { label: "Registry Image", value: "registry" }, { label: "PVC Clone", value: "pvc" }, { label: "Upload", value: "upload" }] },
    { name: "sourceUrl", label: "HTTP / Registry Source", section: "Source", defaultValue: "", placeholder: "https://example.com/disk.qcow2 or docker://..." },
    { name: "sourceNamespace", label: "Source PVC Namespace", section: "Source", defaultValue: "", placeholder: "for PVC clone" },
    { name: "sourcePvc", label: "Source PVC Name", section: "Source", defaultValue: "", placeholder: "for PVC clone" },
  ],
  buildCreateResource: (values) => {
    const storageClassName = stringValue(values.storageClassName);
    const sourceType = stringValue(values.sourceType, "blank");
    const source = sourceType === "http"
      ? { http: { url: stringValue(values.sourceUrl, "https://example.com/disk.qcow2") } }
      : sourceType === "registry"
        ? { registry: { url: stringValue(values.sourceUrl, "docker://quay.io/containerdisks/fedora:latest") } }
        : sourceType === "pvc"
          ? { pvc: { namespace: stringValue(values.sourceNamespace, stringValue(values.namespace, "default")), name: stringValue(values.sourcePvc, "source-pvc") } }
          : sourceType === "upload"
            ? { upload: {} }
            : { blank: {} };
    return {
      apiVersion: "cdi.kubevirt.io/v1beta1",
      kind: "DataVolume",
      metadata: {
        name: stringValue(values.name, "example-disk"),
        namespace: stringValue(values.namespace, "default"),
        labels: { "kubevirt-manager.io/managed": "true" },
      },
      spec: {
        source,
        storage: {
          ...(storageClassName ? { storageClassName } : {}),
          accessModes: [stringValue(values.accessMode, "ReadWriteOnce")],
          volumeMode: stringValue(values.volumeMode, "Filesystem"),
          resources: { requests: { storage: stringValue(values.storage, "10Gi") } },
        },
      },
    };
  },
};

export const resourceConfigs: Record<string, ResourceConfig> = {
  virtualmachinepools: {
    id: "virtualmachinepools",
    path: "/vmpools",
    title: "VM Pools",
    subtitle: "Manage KubeVirt VirtualMachinePool resources",
    listPath: "/apis/pool.kubevirt.io/v1alpha1/virtualmachinepools",
    namespaced: true,
    resourcePath: "/apis/pool.kubevirt.io/v1alpha1",
    kind: "VirtualMachinePool",
    actions: poolActions,
    createFields: [
      ...namespaceNameFields("example-pool"),
      { name: "replicas", label: "Replicas", type: "number", defaultValue: "1" },
      { name: "cpu", label: "CPU Cores", type: "number", defaultValue: "1" },
      { name: "memory", label: "Memory", defaultValue: "1Gi" },
      { name: "containerImage", label: "Container Disk Image", defaultValue: "quay.io/containerdisks/fedora:latest" },
    ],
    buildCreateResource: (values) => {
      const name = stringValue(values.name, "example-pool");
      return {
        apiVersion: "pool.kubevirt.io/v1alpha1",
        kind: "VirtualMachinePool",
        metadata: { name, namespace: stringValue(values.namespace, "default"), labels: { "kubevirt-manager.io/managed": "true" } },
        spec: {
          replicas: numberValue(values.replicas, 1),
          selector: { matchLabels: { "kubevirt.io/vmpool": name } },
          virtualMachineTemplate: {
            metadata: { labels: { "kubevirt.io/vmpool": name, "kubevirt-manager.io/managed": "true" } },
            spec: {
              runStrategy: "Always",
              template: {
                metadata: { labels: { "kubevirt.io/vmpool": name } },
                spec: {
                  domain: {
                    cpu: { cores: numberValue(values.cpu, 1) },
                    resources: { requests: { memory: stringValue(values.memory, "1Gi") } },
                    devices: { disks: [{ name: "containerdisk", disk: { bus: "virtio" } }], interfaces: [{ name: "default", masquerade: {} }] },
                  },
                  networks: [{ name: "default", pod: {} }],
                  volumes: [{ name: "containerdisk", containerDisk: { image: stringValue(values.containerImage, "quay.io/containerdisks/fedora:latest") } }],
                },
              },
            },
          },
        },
      };
    },
    statusPath: ["status", "readyReplicas"],
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      const template = getRecord(spec.virtualMachineTemplate);
      const vmSpec = getRecord(template.spec);
      const podSpec = getRecord(getRecord(vmSpec.template).spec);
      const domain = getRecord(podSpec.domain);
      const devices = getRecord(domain.devices);
      return [
        {
          title: "Pool",
          items: [
            { label: "Replicas", value: spec.replicas },
            { label: "Ready Replicas", value: getRecord(r.status).readyReplicas },
            { label: "Run Strategy", value: vmSpec.runStrategy },
            { label: "Selector", value: selectorText(getRecord(spec.selector).matchLabels) },
          ],
        },
        {
          title: "Template",
          items: [
            { label: "Instance Type", value: getRecord(vmSpec.instancetype).name },
            { label: "CPU", value: getRecord(domain.cpu).cores || getRecord(domain.cpu).guest },
            { label: "Memory", value: getRecord(getRecord(domain.resources).requests).memory },
            { label: "Networks", value: listNames(podSpec.networks) },
            { label: "Disks", value: listNames(devices.disks) },
          ],
        },
      ];
    },
    extraColumns: [
      { label: "Replicas", value: (r) => String((r.spec?.replicas as number | undefined) ?? "N/A") },
      { label: "Ready", value: (r) => String((r.status?.readyReplicas as number | undefined) ?? 0) },
    ],
    createTemplate: `apiVersion: pool.kubevirt.io/v1alpha1
kind: VirtualMachinePool
metadata:
  name: example-pool
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      kubevirt.io/vmpool: example-pool
  virtualMachineTemplate:
    metadata:
      labels:
        kubevirt.io/vmpool: example-pool
    spec:
      runStrategy: Always
      template:
        spec:
          domain:
            devices:
              disks: []
          volumes: []
`,
  },
  nodes: {
    id: "nodes",
    path: "/nodes",
    title: "Nodes",
    subtitle: "Inspect Kubernetes nodes used by KubeVirt workloads",
    listPath: "/api/v1/nodes",
    namespaced: false,
    resourcePath: "/api/v1",
    kind: "Node",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["status", "conditions", "0", "type"],
    detailSections: (r) => {
      const status = getRecord(r.status);
      const spec = getRecord(r.spec);
      const conditions = Array.isArray(status.conditions) ? status.conditions : [];
      const addresses = Array.isArray(status.addresses) ? status.addresses : [];
      const nodeInfo = getRecord(status.nodeInfo);
      const capacity = getRecord(status.capacity);
      const allocatable = getRecord(status.allocatable);
      const resourceKeys = Array.from(new Set([...Object.keys(capacity), ...Object.keys(allocatable)]));
      return [
        {
          title: "Node Status",
          items: [
            { label: "Conditions", value: conditions },
            { label: "Addresses", value: Object.fromEntries(addresses.map((address: any) => [address.type || "Address", address.address])) },
            { label: "Kubelet", value: nodeInfo.kubeletVersion },
            { label: "Container Runtime", value: nodeInfo.containerRuntimeVersion },
            { label: "OS Image", value: nodeInfo.osImage },
            { label: "Architecture", value: nodeInfo.architecture },
          ],
        },
        {
          title: "Resources",
          items: resourceKeys.map((label) => ({
            label,
            value: {
              capacity: capacity[label],
              allocatable: allocatable[label],
            },
          })),
        },
        {
          title: "Scheduling",
          items: [
            { label: "Unschedulable", value: spec.unschedulable || false },
            { label: "Pod CIDR", value: spec.podCIDR },
            { label: "Provider ID", value: spec.providerID },
          ],
        },
      ];
    },
    extraColumns: [
      { label: "CPU", value: (r) => String((r.status?.capacity as Record<string, string> | undefined)?.cpu || "N/A") },
      { label: "Memory", value: (r) => String((r.status?.capacity as Record<string, string> | undefined)?.memory || "N/A") },
    ],
    createTemplate: `apiVersion: v1
kind: Node
metadata:
  name: example-node
`,
  },
  "network-attachment-definitions": {
    id: "network-attachment-definitions",
    path: "/networks/kubernetes/nads",
    title: "Network Attachments",
    subtitle: "Manage Multus network attachment definitions",
    listPath: "/apis/k8s.cni.cncf.io/v1/network-attachment-definitions",
    namespaced: true,
    resourcePath: "/apis/k8s.cni.cncf.io/v1",
    kind: "NetworkAttachmentDefinition",
    createFields: [
      ...namespaceNameFields("bridge-network"),
      { name: "type", label: "CNI Type", type: "select", defaultValue: "bridge", options: [{ label: "Bridge", value: "bridge" }, { label: "Macvlan", value: "macvlan" }] },
      { name: "bridge", label: "Bridge / Master", defaultValue: "br0" },
      { name: "vlan", label: "VLAN", defaultValue: "", placeholder: "optional" },
    ],
    buildCreateResource: (values) => {
      const cniType = stringValue(values.type, "bridge");
      const vlan = stringValue(values.vlan);
      const config = cniType === "macvlan"
        ? { cniVersion: "0.3.1", type: "macvlan", master: stringValue(values.bridge, "eth0"), mode: "bridge", ipam: {} }
        : { cniVersion: "0.3.1", type: "bridge", bridge: stringValue(values.bridge, "br0"), ...(vlan ? { vlan: Number(vlan) } : {}), ipam: {} };
      return {
        apiVersion: "k8s.cni.cncf.io/v1",
        kind: "NetworkAttachmentDefinition",
        metadata: { name: stringValue(values.name, "bridge-network"), namespace: stringValue(values.namespace, "default") },
        spec: { config: JSON.stringify(config, null, 2) },
      };
    },
    detailSections: (r) => {
      let cni: unknown = getRecord(r.spec).config;
      try { cni = typeof cni === "string" ? JSON.parse(cni) : cni; } catch {}
      const cniRecord = getRecord(cni);
      return [{
        title: "CNI Configuration",
        items: [
          { label: "CNI Version", value: cniRecord.cniVersion },
          { label: "Type", value: cniRecord.type },
          { label: "Bridge", value: cniRecord.bridge },
          { label: "Master", value: cniRecord.master },
          { label: "VLAN", value: cniRecord.vlan },
          { label: "IPAM", value: cniRecord.ipam },
        ],
      }];
    },
    createTemplate: `apiVersion: k8s.cni.cncf.io/v1
kind: NetworkAttachmentDefinition
metadata:
  name: bridge-network
  namespace: default
spec:
  config: |
    {
      "cniVersion": "0.3.1",
      "type": "bridge",
      "bridge": "br0",
      "ipam": {}
    }
`,
  },
  services: {
    id: "services",
    path: "/load-balancers",
    title: "Load Balancers",
    subtitle: "Manage Service resources used to expose VMs, pools, and clusters",
    listPath: "/api/v1/services",
    namespaced: true,
    resourcePath: "/api/v1",
    kind: "Service",
    actions: serviceActions,
    createFields: [
      ...namespaceNameFields("example-vm-service"),
      { name: "type", label: "Service Type", type: "select", defaultValue: "LoadBalancer", options: [{ label: "LoadBalancer", value: "LoadBalancer" }, { label: "ClusterIP", value: "ClusterIP" }, { label: "NodePort", value: "NodePort" }] },
      { name: "selectorKey", label: "Selector Key", defaultValue: "kubevirt.io/domain" },
      { name: "selectorValue", label: "Selector Value", defaultValue: "example-vm" },
      { name: "portName", label: "Port Name", defaultValue: "ssh" },
      { name: "port", label: "Port", type: "number", defaultValue: "22" },
      { name: "targetPort", label: "Target Port", type: "number", defaultValue: "22" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: stringValue(values.name, "example-vm-service"), namespace: stringValue(values.namespace, "default"), labels: { "kubevirt-manager.io/managed": "true" } },
      spec: {
        type: stringValue(values.type, "LoadBalancer"),
        selector: { [stringValue(values.selectorKey, "kubevirt.io/domain")]: stringValue(values.selectorValue, "example-vm") },
        ports: [{ name: stringValue(values.portName, "ssh"), port: numberValue(values.port, 22), targetPort: numberValue(values.targetPort, 22), protocol: "TCP" }],
      },
    }),
    statusPath: ["spec", "type"],
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      const status = getRecord(r.status);
      return [
        {
          title: "Service",
          items: [
            { label: "Type", value: spec.type },
            { label: "Cluster IP", value: spec.clusterIP },
            { label: "External Traffic Policy", value: spec.externalTrafficPolicy },
            { label: "Selector", value: selectorText(spec.selector) },
          ],
        },
        {
          title: "Ports",
          items: (Array.isArray(spec.ports) ? spec.ports : []).map((port: any) => ({
            label: port.name || `${port.port}`,
            value: `${port.protocol || "TCP"} ${port.port} -> ${port.targetPort}${port.nodePort ? ` nodePort ${port.nodePort}` : ""}`,
          })),
        },
        {
          title: "Load Balancer",
          items: [
            { label: "Ingress", value: getRecord(status.loadBalancer).ingress },
          ],
        },
      ];
    },
    extraColumns: [
      { label: "Type", value: (r) => String((r.spec?.type as string | undefined) || "ClusterIP") },
      { label: "Cluster IP", value: (r) => String((r.spec?.clusterIP as string | undefined) || "N/A") },
    ],
    createTemplate: `apiVersion: v1
kind: Service
metadata:
  name: example-vm-service
  namespace: default
spec:
  type: LoadBalancer
  selector:
    kubevirt.io/domain: example-vm
  ports:
    - name: ssh
      port: 22
      targetPort: 22
`,
  },
  virtualmachineclusterinstancetypes: {
    id: "virtualmachineclusterinstancetypes",
    path: "/instance-types",
    title: "Cluster Instance Types",
    subtitle: "Manage reusable KubeVirt compute shapes",
    listPath: "/apis/instancetype.kubevirt.io/v1beta1/virtualmachineclusterinstancetypes",
    namespaced: false,
    resourcePath: "/apis/instancetype.kubevirt.io/v1beta1",
    kind: "VirtualMachineClusterInstancetype",
    actions: instanceTypeActions,
    createFields: [
      { name: "name", label: "Name", defaultValue: "example-small", required: true },
      { name: "cpu", label: "Guest CPUs", type: "number", defaultValue: "1" },
      { name: "memory", label: "Guest Memory", defaultValue: "1Gi" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "instancetype.kubevirt.io/v1beta1",
      kind: "VirtualMachineClusterInstancetype",
      metadata: { name: stringValue(values.name, "example-small") },
      spec: { cpu: { guest: numberValue(values.cpu, 1) }, memory: { guest: stringValue(values.memory, "1Gi") } },
    }),
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      return [{
        title: "Compute Shape",
        items: [
          { label: "Guest CPUs", value: getRecord(spec.cpu).guest },
          { label: "Guest Memory", value: getRecord(spec.memory).guest },
          { label: "IO Threads Policy", value: spec.ioThreadsPolicy },
          { label: "Launch Security", value: spec.launchSecurity },
        ],
      }];
    },
    extraColumns: [
      { label: "CPU", value: (r) => String(((r.spec?.cpu as Record<string, unknown> | undefined)?.guest as number | undefined) ?? "N/A") },
      { label: "Memory", value: (r) => String(((r.spec?.memory as Record<string, unknown> | undefined)?.guest as string | undefined) || "N/A") },
    ],
    createTemplate: `apiVersion: instancetype.kubevirt.io/v1beta1
kind: VirtualMachineClusterInstancetype
metadata:
  name: example-small
spec:
  cpu:
    guest: 1
  memory:
    guest: 1Gi
`,
  },
  virtualmachinesnapshots: {
    id: "virtualmachinesnapshots",
    path: "/snapshots",
    title: "Snapshots",
    subtitle: "Create and manage KubeVirt virtual machine snapshots",
    listPath: "/apis/snapshot.kubevirt.io/v1beta1/virtualmachinesnapshots",
    namespaced: true,
    resourcePath: "/apis/snapshot.kubevirt.io/v1beta1",
    kind: "VirtualMachineSnapshot",
    createFields: [
      ...namespaceNameFields("example-snapshot"),
      { name: "sourceVm", label: "Source VM", defaultValue: "example-vm", required: true },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "snapshot.kubevirt.io/v1beta1",
      kind: "VirtualMachineSnapshot",
      metadata: { name: stringValue(values.name, "example-snapshot"), namespace: stringValue(values.namespace, "default") },
      spec: { source: { apiGroup: "kubevirt.io", kind: "VirtualMachine", name: stringValue(values.sourceVm, "example-vm") } },
    }),
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      const status = getRecord(r.status);
      return [
        {
          title: "Snapshot Source",
          items: [
            { label: "Source Kind", value: getRecord(spec.source).kind },
            { label: "Source VM", value: getRecord(spec.source).name },
            { label: "Ready To Use", value: status.readyToUse },
            { label: "Creation Time", value: status.creationTime },
          ],
        },
        {
          title: "Snapshot Content",
          items: [
            { label: "Content Name", value: status.virtualMachineSnapshotContentName },
            { label: "Indications", value: status.indications },
          ],
        },
      ];
    },
    statusPath: ["status", "readyToUse"],
    extraColumns: [
      { label: "Source VM", value: (r) => String(((r.spec?.source as Record<string, unknown> | undefined)?.name as string | undefined) || "N/A") },
    ],
    createTemplate: `apiVersion: snapshot.kubevirt.io/v1beta1
kind: VirtualMachineSnapshot
metadata:
  name: example-snapshot
  namespace: default
spec:
  source:
    apiGroup: kubevirt.io
    kind: VirtualMachine
    name: example-vm
`,
  },
  virtualmachinerestores: {
    id: "virtualmachinerestores",
    path: "/restores",
    title: "Restores",
    subtitle: "Restore VMs from KubeVirt snapshots",
    listPath: "/apis/snapshot.kubevirt.io/v1beta1/virtualmachinerestores",
    namespaced: true,
    resourcePath: "/apis/snapshot.kubevirt.io/v1beta1",
    kind: "VirtualMachineRestore",
    createFields: [
      ...namespaceNameFields("example-restore"),
      { name: "targetVm", label: "Target VM", defaultValue: "example-vm", required: true },
      { name: "snapshotName", label: "Snapshot Name", defaultValue: "example-snapshot", required: true },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "snapshot.kubevirt.io/v1beta1",
      kind: "VirtualMachineRestore",
      metadata: { name: stringValue(values.name, "example-restore"), namespace: stringValue(values.namespace, "default") },
      spec: {
        target: { apiGroup: "kubevirt.io", kind: "VirtualMachine", name: stringValue(values.targetVm, "example-vm") },
        virtualMachineSnapshotName: stringValue(values.snapshotName, "example-snapshot"),
      },
    }),
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      const status = getRecord(r.status);
      return [{
        title: "Restore",
        items: [
          { label: "Snapshot", value: spec.virtualMachineSnapshotName },
          { label: "Target Kind", value: getRecord(spec.target).kind },
          { label: "Target VM", value: getRecord(spec.target).name },
          { label: "Complete", value: status.complete },
          { label: "Restore Time", value: status.restoreTime },
        ],
      }];
    },
    statusPath: ["status", "complete"],
    extraColumns: [
      { label: "Target VM", value: (r) => String(((r.spec?.target as Record<string, unknown> | undefined)?.name as string | undefined) || "N/A") },
    ],
    createTemplate: `apiVersion: snapshot.kubevirt.io/v1beta1
kind: VirtualMachineRestore
metadata:
  name: example-restore
  namespace: default
spec:
  target:
    apiGroup: kubevirt.io
    kind: VirtualMachine
    name: example-vm
  virtualMachineSnapshotName: example-snapshot
`,
  },
  secrets: {
    id: "secrets",
    path: "/ssh-keys",
    title: "SSH Keys",
    subtitle: "Manage Secret resources used for SSH access",
    listPath: "/api/v1/secrets?labelSelector=kubevirt-manager.io/managed%3Dtrue,kubevirt-manager.io/ssh%3Dtrue",
    namespaced: true,
    resourcePath: "/api/v1",
    kind: "Secret",
    createFields: [
      ...namespaceNameFields("example-ssh-key"),
      { name: "key", label: "SSH Public Key", type: "textarea", defaultValue: "ssh-rsa AAAA..." },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: stringValue(values.name, "example-ssh-key"),
        namespace: stringValue(values.namespace, "default"),
        labels: { "kubevirt-manager.io/managed": "true", "kubevirt-manager.io/ssh": "true" },
      },
      type: "Opaque",
      stringData: { key: stringValue(values.key, "ssh-rsa AAAA...") },
    }),
    statusPath: ["type"],
    detailSections: (r) => [{
      title: "Secret",
      items: [
        { label: "Type", value: r.type },
        { label: "Keys", value: Object.keys(getRecord(r.data)) },
        { label: "String Data Keys", value: Object.keys(getRecord(r.stringData)) },
      ],
    }],
    extraColumns: [
      { label: "Type", value: (r) => String((r as unknown as { type?: string }).type || "Opaque") },
    ],
    createTemplate: `apiVersion: v1
kind: Secret
metadata:
  name: example-ssh-key
  namespace: default
  labels:
    kubevirt-manager.io/managed: "true"
    kubevirt-manager.io/ssh: "true"
type: Opaque
stringData:
  key: ssh-rsa AAAA...
`,
  },
  networkpolicies: {
    id: "networkpolicies",
    path: "/networks/kubernetes/network-policies",
    title: "Network Policies",
    subtitle: "Manage Kubernetes NetworkPolicy firewall rules",
    listPath: "/apis/networking.k8s.io/v1/networkpolicies",
    namespaced: true,
    resourcePath: "/apis/networking.k8s.io/v1",
    kind: "NetworkPolicy",
    actions: networkPolicyActions,
    createFields: [
      ...namespaceNameFields("example-vm-policy"),
      { name: "selectorKey", label: "Pod Selector Key", defaultValue: "kubevirt.io/domain" },
      { name: "selectorValue", label: "Pod Selector Value", defaultValue: "example-vm" },
      { name: "policyType", label: "Policy Type", type: "select", defaultValue: "Ingress", options: [{ label: "Ingress", value: "Ingress" }, { label: "Egress", value: "Egress" }, { label: "Ingress and Egress", value: "Both" }] },
    ],
    buildCreateResource: (values) => {
      const policyType = stringValue(values.policyType, "Ingress");
      return {
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata: { name: stringValue(values.name, "example-vm-policy"), namespace: stringValue(values.namespace, "default") },
        spec: {
          podSelector: { matchLabels: { [stringValue(values.selectorKey, "kubevirt.io/domain")]: stringValue(values.selectorValue, "example-vm") } },
          policyTypes: policyType === "Both" ? ["Ingress", "Egress"] : [policyType],
        },
      };
    },
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      return [{
        title: "Policy",
        items: [
          { label: "Pod Selector", value: selectorText(getRecord(spec.podSelector).matchLabels) },
          { label: "Policy Types", value: spec.policyTypes },
          { label: "Ingress Rules", value: Array.isArray(spec.ingress) ? spec.ingress.length : 0 },
          { label: "Egress Rules", value: Array.isArray(spec.egress) ? spec.egress.length : 0 },
        ],
      }];
    },
    extraColumns: [
      { label: "Policy Types", value: (r) => ((r.spec?.policyTypes as string[] | undefined) || []).join(", ") || "N/A" },
    ],
    createTemplate: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: example-vm-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      kubevirt.io/domain: example-vm
  policyTypes:
    - Ingress
`,
  },
  ingresses: {
    id: "ingresses",
    path: "/networks/kubernetes/ingresses",
    title: "Ingresses",
    subtitle: "Manage Kubernetes Ingress HTTP routing resources",
    listPath: "/apis/networking.k8s.io/v1/ingresses",
    namespaced: true,
    resourcePath: "/apis/networking.k8s.io/v1",
    kind: "Ingress",
    createFields: [
      ...namespaceNameFields("example-ingress"),
      { name: "className", label: "Ingress Class", section: "Routing", defaultValue: "nginx", placeholder: "optional" },
      { name: "host", label: "Host", section: "Routing", defaultValue: "example.local" },
      { name: "path", label: "Path", section: "Routing", defaultValue: "/" },
      { name: "serviceName", label: "Service Name", section: "Backend", defaultValue: "example-service" },
      { name: "servicePort", label: "Service Port", section: "Backend", type: "number", defaultValue: "80" },
      { name: "tlsSecretName", label: "TLS Secret", section: "TLS", defaultValue: "", placeholder: "optional" },
    ],
    buildCreateResource: (values) => {
      const host = stringValue(values.host, "example.local");
      const tlsSecretName = stringValue(values.tlsSecretName);
      return {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: { name: stringValue(values.name, "example-ingress"), namespace: stringValue(values.namespace, "default") },
        spec: {
          ...(stringValue(values.className) ? { ingressClassName: stringValue(values.className) } : {}),
          rules: [{
            host,
            http: {
              paths: [{
                path: stringValue(values.path, "/"),
                pathType: "Prefix",
                backend: { service: { name: stringValue(values.serviceName, "example-service"), port: { number: numberValue(values.servicePort, 80) } } },
              }],
            },
          }],
          ...(tlsSecretName ? { tls: [{ hosts: [host], secretName: tlsSecretName }] } : {}),
        },
      };
    },
    statusPath: ["spec", "ingressClassName"],
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      const status = getRecord(r.status);
      return [{
        title: "Ingress",
        items: [
          { label: "Class", value: spec.ingressClassName },
          { label: "Rules", value: spec.rules },
          { label: "TLS", value: spec.tls },
          { label: "Load Balancer", value: getRecord(status.loadBalancer).ingress },
        ],
      }];
    },
    extraColumns: [
      { label: "Class", value: (r) => String(getRecord(r.spec).ingressClassName || "N/A") },
      { label: "Hosts", value: (r) => (Array.isArray(getRecord(r.spec).rules) ? getRecord(r.spec).rules.map((rule: any) => rule.host).filter(Boolean).join(", ") : "") || "N/A" },
    ],
    createTemplate: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
  namespace: default
spec:
  rules: []
`,
  },
  kubernetesServices: {
    id: "services",
    path: "/networks/kubernetes/services",
    title: "Services",
    subtitle: "Manage Kubernetes Service network endpoints",
    listPath: "/api/v1/services",
    namespaced: true,
    resourcePath: "/api/v1",
    kind: "Service",
    createFields: [
      ...namespaceNameFields("example-service"),
      { name: "type", label: "Type", section: "Service", type: "select", defaultValue: "ClusterIP", options: [{ label: "ClusterIP", value: "ClusterIP" }, { label: "NodePort", value: "NodePort" }, { label: "LoadBalancer", value: "LoadBalancer" }] },
      { name: "selectorKey", label: "Selector Key", section: "Selector", defaultValue: "app" },
      { name: "selectorValue", label: "Selector Value", section: "Selector", defaultValue: "example" },
      { name: "port", label: "Port", section: "Ports", type: "number", defaultValue: "80" },
      { name: "targetPort", label: "Target Port", section: "Ports", type: "number", defaultValue: "80" },
      { name: "protocol", label: "Protocol", section: "Ports", type: "select", defaultValue: "TCP", options: [{ label: "TCP", value: "TCP" }, { label: "UDP", value: "UDP" }, { label: "SCTP", value: "SCTP" }] },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: stringValue(values.name, "example-service"), namespace: stringValue(values.namespace, "default") },
      spec: {
        type: stringValue(values.type, "ClusterIP"),
        selector: { [stringValue(values.selectorKey, "app")]: stringValue(values.selectorValue, "example") },
        ports: [{ port: numberValue(values.port, 80), targetPort: numberValue(values.targetPort, 80), protocol: stringValue(values.protocol, "TCP") }],
      },
    }),
    statusPath: ["spec", "type"],
    detailSections: (r) => [{ title: "Service", items: [{ label: "Type", value: getRecord(r.spec).type }, { label: "Cluster IP", value: getRecord(r.spec).clusterIP }, { label: "External IPs", value: getRecord(r.spec).externalIPs }, { label: "Ports", value: getRecord(r.spec).ports }, { label: "Selector", value: getRecord(r.spec).selector }, { label: "Load Balancer", value: getRecord(r.status).loadBalancer }] }],
    extraColumns: [{ label: "Type", value: (r) => String(getRecord(r.spec).type || "N/A") }, { label: "Cluster IP", value: (r) => String(getRecord(r.spec).clusterIP || "N/A") }],
    createTemplate: `apiVersion: v1
kind: Service
metadata:
  name: example-service
  namespace: default
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
`,
  },
  endpoints: {
    id: "endpoints",
    path: "/networks/kubernetes/endpoints",
    title: "Endpoints",
    subtitle: "Inspect Kubernetes Endpoints selected by Services",
    listPath: "/api/v1/endpoints",
    namespaced: true,
    resourcePath: "/api/v1",
    kind: "Endpoints",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["subsets", "0", "addresses", "0", "ip"],
    detailSections: (r) => [{ title: "Endpoints", items: [{ label: "Subsets", value: (r as any).subsets }] }],
    extraColumns: [{ label: "Subsets", value: (r) => String(((r as any).subsets as unknown[] | undefined)?.length || 0) }],
    createTemplate: `apiVersion: v1
kind: Endpoints
metadata:
  name: example-endpoints
  namespace: default
`,
  },
  endpointSlices: {
    id: "endpointslices",
    path: "/networks/kubernetes/endpoint-slices",
    title: "Endpoint Slices",
    subtitle: "Inspect Kubernetes discovery EndpointSlice resources",
    listPath: "/apis/discovery.k8s.io/v1/endpointslices",
    namespaced: true,
    resourcePath: "/apis/discovery.k8s.io/v1",
    kind: "EndpointSlice",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["addressType"],
    detailSections: (r) => [{ title: "Endpoint Slice", items: [{ label: "Address Type", value: (r as any).addressType }, { label: "Endpoints", value: (r as any).endpoints }, { label: "Ports", value: (r as any).ports }] }],
    extraColumns: [{ label: "Address Type", value: (r) => String((r as any).addressType || "N/A") }, { label: "Endpoints", value: (r) => String(((r as any).endpoints as unknown[] | undefined)?.length || 0) }],
    createTemplate: `apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: example-endpoint-slice
  namespace: default
addressType: IPv4
`,
  },
  ingressClasses: {
    id: "ingressclasses",
    path: "/networks/kubernetes/ingress-classes",
    title: "Ingress Classes",
    subtitle: "Manage Kubernetes IngressClass controller bindings",
    listPath: "/apis/networking.k8s.io/v1/ingressclasses",
    namespaced: false,
    resourcePath: "/apis/networking.k8s.io/v1",
    kind: "IngressClass",
    createFields: [...nameOnlyFields("example-ingress-class"), { name: "controller", label: "Controller", section: "Controller", defaultValue: "k8s.io/ingress-nginx" }, { name: "isDefault", label: "Default Class", section: "Controller", type: "checkbox", defaultValue: false }],
    buildCreateResource: (values) => ({
      apiVersion: "networking.k8s.io/v1",
      kind: "IngressClass",
      metadata: {
        name: stringValue(values.name, "example-ingress-class"),
        ...(values.isDefault === true ? { annotations: { "ingressclass.kubernetes.io/is-default-class": "true" } } : {}),
      },
      spec: { controller: stringValue(values.controller, "k8s.io/ingress-nginx") },
    }),
    statusPath: ["spec", "controller"],
    detailSections: (r) => [{ title: "Ingress Class", items: [{ label: "Controller", value: getRecord(r.spec).controller }, { label: "Parameters", value: getRecord(r.spec).parameters }] }],
    extraColumns: [{ label: "Controller", value: (r) => String(getRecord(r.spec).controller || "N/A") }],
    createTemplate: `apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: example-ingress-class
spec:
  controller: k8s.io/ingress-nginx
`,
  },
  gatewayclasses: {
    id: "gatewayclasses",
    path: "/networks/gateway-api/gateway-classes",
    title: "Gateway Classes",
    subtitle: "Manage Gateway API cluster-scoped GatewayClass resources",
    listPath: "/apis/gateway.networking.k8s.io/v1/gatewayclasses",
    namespaced: false,
    resourcePath: "/apis/gateway.networking.k8s.io/v1",
    kind: "GatewayClass",
    createFields: [
      ...nameOnlyFields("example-gateway-class"),
      { name: "controllerName", label: "Controller Name", section: "Gateway", defaultValue: "example.com/gateway-controller" },
      { name: "description", label: "Description", section: "Gateway", defaultValue: "" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "GatewayClass",
      metadata: { name: stringValue(values.name, "example-gateway-class") },
      spec: {
        controllerName: stringValue(values.controllerName, "example.com/gateway-controller"),
        ...(stringValue(values.description) ? { description: stringValue(values.description) } : {}),
      },
    }),
    statusPath: ["status", "conditions", "0", "type"],
    detailSections: (r) => [{ title: "Gateway Class", items: [{ label: "Controller", value: getRecord(r.spec).controllerName }, { label: "Description", value: getRecord(r.spec).description }, { label: "Conditions", value: getRecord(r.status).conditions }] }],
    extraColumns: [{ label: "Controller", value: (r) => String(getRecord(r.spec).controllerName || "N/A") }],
    createTemplate: `apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: example-gateway-class
spec:
  controllerName: example.com/gateway-controller
`,
  },
  gateways: {
    id: "gateways",
    path: "/networks/gateway-api/gateways",
    title: "Gateways",
    subtitle: "Manage Gateway API Gateway listeners",
    listPath: "/apis/gateway.networking.k8s.io/v1/gateways",
    namespaced: true,
    resourcePath: "/apis/gateway.networking.k8s.io/v1",
    kind: "Gateway",
    createFields: [
      ...namespaceNameFields("example-gateway"),
      { name: "gatewayClassName", label: "Gateway Class", section: "Gateway", defaultValue: "example-gateway-class" },
      { name: "listenerName", label: "Listener Name", section: "Listener", defaultValue: "http" },
      { name: "hostname", label: "Hostname", section: "Listener", defaultValue: "", placeholder: "optional" },
      { name: "port", label: "Port", section: "Listener", type: "number", defaultValue: "80" },
      { name: "protocol", label: "Protocol", section: "Listener", type: "select", defaultValue: "HTTP", options: [{ label: "HTTP", value: "HTTP" }, { label: "HTTPS", value: "HTTPS" }, { label: "TCP", value: "TCP" }, { label: "TLS", value: "TLS" }] },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "Gateway",
      metadata: { name: stringValue(values.name, "example-gateway"), namespace: stringValue(values.namespace, "default") },
      spec: {
        gatewayClassName: stringValue(values.gatewayClassName, "example-gateway-class"),
        listeners: [{
          name: stringValue(values.listenerName, "http"),
          ...(stringValue(values.hostname) ? { hostname: stringValue(values.hostname) } : {}),
          port: numberValue(values.port, 80),
          protocol: stringValue(values.protocol, "HTTP"),
        }],
      },
    }),
    statusPath: ["status", "conditions", "0", "type"],
    detailSections: (r) => [{ title: "Gateway", items: [{ label: "Class", value: getRecord(r.spec).gatewayClassName }, { label: "Listeners", value: getRecord(r.spec).listeners }, { label: "Addresses", value: getRecord(r.status).addresses }, { label: "Conditions", value: getRecord(r.status).conditions }] }],
    extraColumns: [{ label: "Class", value: (r) => String(getRecord(r.spec).gatewayClassName || "N/A") }, { label: "Listeners", value: (r) => String((getRecord(r.spec).listeners as unknown[] | undefined)?.length || 0) }],
    createTemplate: `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: example-gateway
  namespace: default
spec:
  gatewayClassName: example-gateway-class
  listeners: []
`,
  },
  httproutes: {
    id: "httproutes",
    path: "/networks/gateway-api/http-routes",
    title: "HTTP Routes",
    subtitle: "Manage Gateway API HTTPRoute resources",
    listPath: "/apis/gateway.networking.k8s.io/v1/httproutes",
    namespaced: true,
    resourcePath: "/apis/gateway.networking.k8s.io/v1",
    kind: "HTTPRoute",
    createFields: [
      ...namespaceNameFields("example-http-route"),
      { name: "parentGateway", label: "Parent Gateway", section: "Parent", defaultValue: "example-gateway" },
      { name: "sectionName", label: "Listener Section", section: "Parent", defaultValue: "http", placeholder: "optional" },
      { name: "host", label: "Hostname", section: "Match", defaultValue: "example.local" },
      { name: "path", label: "Path Prefix", section: "Match", defaultValue: "/" },
      { name: "serviceName", label: "Backend Service", section: "Backend", defaultValue: "example-service" },
      { name: "servicePort", label: "Backend Port", section: "Backend", type: "number", defaultValue: "80" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata: { name: stringValue(values.name, "example-http-route"), namespace: stringValue(values.namespace, "default") },
      spec: {
        parentRefs: [{ name: stringValue(values.parentGateway, "example-gateway"), ...(stringValue(values.sectionName) ? { sectionName: stringValue(values.sectionName) } : {}) }],
        hostnames: [stringValue(values.host, "example.local")],
        rules: [{
          matches: [{ path: { type: "PathPrefix", value: stringValue(values.path, "/") } }],
          backendRefs: [{ name: stringValue(values.serviceName, "example-service"), port: numberValue(values.servicePort, 80) }],
        }],
      },
    }),
    statusPath: ["status", "parents", "0", "conditions", "0", "type"],
    detailSections: (r) => [{ title: "HTTPRoute", items: [{ label: "Parents", value: getRecord(r.spec).parentRefs }, { label: "Hostnames", value: getRecord(r.spec).hostnames }, { label: "Rules", value: getRecord(r.spec).rules }, { label: "Status Parents", value: getRecord(r.status).parents }] }],
    extraColumns: [{ label: "Hostnames", value: (r) => (getRecord(r.spec).hostnames as string[] | undefined)?.join(", ") || "N/A" }],
    createTemplate: `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-http-route
  namespace: default
spec:
  parentRefs: []
  rules: []
`,
  },
  calicoNetworkPolicies: {
    id: "networkpolicies",
    path: "/networks/calico/network-policies",
    title: "Calico Network Policies",
    subtitle: "Manage Calico namespaced NetworkPolicy resources",
    listPath: "/apis/projectcalico.org/v3/networkpolicies",
    namespaced: true,
    resourcePath: "/apis/projectcalico.org/v3",
    kind: "NetworkPolicy",
    createFields: [
      ...namespaceNameFields("example-calico-policy"),
      { name: "selector", label: "Selector", section: "Policy", defaultValue: "all()" },
      { name: "types", label: "Types", section: "Policy", type: "select", defaultValue: "Ingress", options: [{ label: "Ingress", value: "Ingress" }, { label: "Egress", value: "Egress" }, { label: "Ingress and Egress", value: "Both" }] },
      { name: "action", label: "Action", section: "Rule", type: "select", defaultValue: "Allow", options: [{ label: "Allow", value: "Allow" }, { label: "Deny", value: "Deny" }, { label: "Pass", value: "Pass" }, { label: "Log", value: "Log" }] },
      { name: "protocol", label: "Protocol", section: "Rule", defaultValue: "TCP" },
      { name: "destinationPort", label: "Destination Port", section: "Rule", type: "number", defaultValue: "80" },
    ],
    buildCreateResource: (values) => {
      const types = stringValue(values.types, "Ingress") === "Both" ? ["Ingress", "Egress"] : [stringValue(values.types, "Ingress")];
      const rule = { action: stringValue(values.action, "Allow"), protocol: stringValue(values.protocol, "TCP"), destination: { ports: [numberValue(values.destinationPort, 80)] } };
      return {
        apiVersion: "projectcalico.org/v3",
        kind: "NetworkPolicy",
        metadata: { name: stringValue(values.name, "example-calico-policy"), namespace: stringValue(values.namespace, "default") },
        spec: { selector: stringValue(values.selector, "all()"), types, ...(types.includes("Ingress") ? { ingress: [rule] } : {}), ...(types.includes("Egress") ? { egress: [rule] } : {}) },
      };
    },
    statusPath: ["spec", "selector"],
    detailSections: (r) => [{ title: "Calico Policy", items: [{ label: "Selector", value: getRecord(r.spec).selector }, { label: "Types", value: getRecord(r.spec).types }, { label: "Ingress", value: getRecord(r.spec).ingress }, { label: "Egress", value: getRecord(r.spec).egress }] }],
    extraColumns: [{ label: "Selector", value: (r) => String(getRecord(r.spec).selector || "N/A") }],
    createTemplate: `apiVersion: projectcalico.org/v3
kind: NetworkPolicy
metadata:
  name: example-calico-policy
  namespace: default
spec:
  selector: all()
`,
  },
  calicoGlobalNetworkPolicies: {
    id: "globalnetworkpolicies",
    path: "/networks/calico/global-network-policies",
    title: "Calico Global Network Policies",
    subtitle: "Manage Calico cluster-scoped GlobalNetworkPolicy resources",
    listPath: "/apis/projectcalico.org/v3/globalnetworkpolicies",
    namespaced: false,
    resourcePath: "/apis/projectcalico.org/v3",
    kind: "GlobalNetworkPolicy",
    createFields: [
      ...nameOnlyFields("example-global-policy"),
      { name: "selector", label: "Selector", section: "Policy", defaultValue: "all()" },
      { name: "order", label: "Order", section: "Policy", type: "number", defaultValue: "100" },
      { name: "types", label: "Types", section: "Policy", type: "select", defaultValue: "Ingress", options: [{ label: "Ingress", value: "Ingress" }, { label: "Egress", value: "Egress" }, { label: "Ingress and Egress", value: "Both" }] },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "projectcalico.org/v3",
      kind: "GlobalNetworkPolicy",
      metadata: { name: stringValue(values.name, "example-global-policy") },
      spec: { selector: stringValue(values.selector, "all()"), order: numberValue(values.order, 100), types: stringValue(values.types, "Ingress") === "Both" ? ["Ingress", "Egress"] : [stringValue(values.types, "Ingress")] },
    }),
    statusPath: ["spec", "selector"],
    detailSections: (r) => [{ title: "Calico Global Policy", items: [{ label: "Order", value: getRecord(r.spec).order }, { label: "Selector", value: getRecord(r.spec).selector }, { label: "Types", value: getRecord(r.spec).types }] }],
    extraColumns: [{ label: "Order", value: (r) => String(getRecord(r.spec).order || "N/A") }],
    createTemplate: `apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: example-global-policy
spec:
  selector: all()
`,
  },
  calicoIPPools: {
    id: "ippools",
    path: "/networks/calico/ip-pools",
    title: "Calico IP Pools",
    subtitle: "Manage Calico IPPool resources",
    listPath: "/apis/projectcalico.org/v3/ippools",
    namespaced: false,
    resourcePath: "/apis/projectcalico.org/v3",
    kind: "IPPool",
    createFields: [
      ...nameOnlyFields("example-pool"),
      { name: "cidr", label: "CIDR", section: "Pool", defaultValue: "10.244.0.0/16" },
      { name: "encapsulation", label: "Encapsulation", section: "Pool", type: "select", defaultValue: "VXLAN", options: [{ label: "VXLAN", value: "VXLAN" }, { label: "IPIP", value: "IPIP" }, { label: "None", value: "None" }] },
      { name: "natOutgoing", label: "NAT Outgoing", section: "Pool", type: "checkbox", defaultValue: true },
      { name: "disabled", label: "Disabled", section: "Pool", type: "checkbox", defaultValue: false },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "projectcalico.org/v3",
      kind: "IPPool",
      metadata: { name: stringValue(values.name, "example-pool") },
      spec: { cidr: stringValue(values.cidr, "10.244.0.0/16"), encapsulation: stringValue(values.encapsulation, "VXLAN"), natOutgoing: values.natOutgoing === true, disabled: values.disabled === true },
    }),
    statusPath: ["spec", "cidr"],
    detailSections: (r) => [{ title: "IPPool", items: [{ label: "CIDR", value: getRecord(r.spec).cidr }, { label: "Encapsulation", value: getRecord(r.spec).encapsulation }, { label: "NAT Outgoing", value: getRecord(r.spec).natOutgoing }, { label: "Disabled", value: getRecord(r.spec).disabled }] }],
    extraColumns: [{ label: "CIDR", value: (r) => String(getRecord(r.spec).cidr || "N/A") }],
    createTemplate: `apiVersion: projectcalico.org/v3
kind: IPPool
metadata:
  name: example-pool
spec:
  cidr: 10.244.0.0/16
`,
  },
  calicoTiers: calicoResourceConfig({
    plural: "tiers",
    path: "/networks/calico/tiers",
    title: "Calico Tiers",
    subtitle: "Manage Calico policy ordering tiers",
    kind: "Tier",
    createFields: [{ name: "order", label: "Order", section: "Tier", type: "number", defaultValue: "100" }, { name: "defaultAction", label: "Default Action", section: "Tier", type: "select", defaultValue: "Deny", options: [{ label: "Deny", value: "Deny" }, { label: "Pass", value: "Pass" }] }],
    buildSpec: (values) => ({ order: numberValue(values.order, 100), defaultAction: stringValue(values.defaultAction, "Deny") }),
    statusPath: ["spec", "order"],
    extraColumns: [{ label: "Order", value: (r) => String(getRecord(r.spec).order || "N/A") }],
  }),
  calicoNetworkSets: calicoResourceConfig({
    plural: "networksets",
    path: "/networks/calico/network-sets",
    title: "Calico Network Sets",
    subtitle: "Manage namespaced Calico NetworkSet CIDR groups",
    kind: "NetworkSet",
    namespaced: true,
    createFields: [{ name: "nets", label: "CIDRs", section: "Networks", defaultValue: "10.0.0.0/8", placeholder: "comma-separated CIDRs" }],
    buildSpec: (values) => ({ nets: csvList(values.nets) }),
    statusPath: ["spec", "nets", "0"],
    extraColumns: [{ label: "CIDRs", value: (r) => ((getRecord(r.spec).nets as string[] | undefined) || []).join(", ") || "N/A" }],
  }),
  calicoGlobalNetworkSets: calicoResourceConfig({
    plural: "globalnetworksets",
    path: "/networks/calico/global-network-sets",
    title: "Calico Global Network Sets",
    subtitle: "Manage cluster-scoped Calico GlobalNetworkSet CIDR groups",
    kind: "GlobalNetworkSet",
    createFields: [{ name: "nets", label: "CIDRs", section: "Networks", defaultValue: "10.0.0.0/8", placeholder: "comma-separated CIDRs" }],
    buildSpec: (values) => ({ nets: csvList(values.nets) }),
    statusPath: ["spec", "nets", "0"],
    extraColumns: [{ label: "CIDRs", value: (r) => ((getRecord(r.spec).nets as string[] | undefined) || []).join(", ") || "N/A" }],
  }),
  calicoStagedNetworkPolicies: calicoResourceConfig({
    plural: "stagednetworkpolicies",
    path: "/networks/calico/staged-network-policies",
    title: "Calico Staged Network Policies",
    subtitle: "Manage namespaced Calico staged NetworkPolicy resources",
    kind: "StagedNetworkPolicy",
    namespaced: true,
    createFields: [{ name: "selector", label: "Selector", section: "Policy", defaultValue: "all()" }, { name: "types", label: "Types", section: "Policy", defaultValue: "Ingress" }],
    buildSpec: (values) => ({ selector: stringValue(values.selector, "all()"), types: [stringValue(values.types, "Ingress")] }),
    statusPath: ["spec", "selector"],
  }),
  calicoStagedGlobalNetworkPolicies: calicoResourceConfig({
    plural: "stagedglobalnetworkpolicies",
    path: "/networks/calico/staged-global-network-policies",
    title: "Calico Staged Global Policies",
    subtitle: "Manage cluster-scoped Calico staged GlobalNetworkPolicy resources",
    kind: "StagedGlobalNetworkPolicy",
    createFields: [{ name: "selector", label: "Selector", section: "Policy", defaultValue: "all()" }, { name: "order", label: "Order", section: "Policy", type: "number", defaultValue: "100" }],
    buildSpec: (values) => ({ selector: stringValue(values.selector, "all()"), order: numberValue(values.order, 100) }),
    statusPath: ["spec", "selector"],
  }),
  calicoStagedKubernetesNetworkPolicies: calicoResourceConfig({
    plural: "stagedkubernetesnetworkpolicies",
    path: "/networks/calico/staged-kubernetes-network-policies",
    title: "Calico Staged Kubernetes Policies",
    subtitle: "Manage staged Kubernetes NetworkPolicy resources in Calico",
    kind: "StagedKubernetesNetworkPolicy",
    namespaced: true,
    createFields: [{ name: "selectorKey", label: "Pod Selector Key", section: "Policy", defaultValue: "app" }, { name: "selectorValue", label: "Pod Selector Value", section: "Policy", defaultValue: "example" }],
    buildSpec: (values) => ({ podSelector: selectorFromValues(values), policyTypes: ["Ingress"] }),
    statusPath: ["spec", "policyTypes", "0"],
  }),
  calicoHostEndpoints: calicoResourceConfig({
    plural: "hostendpoints",
    path: "/networks/calico/host-endpoints",
    title: "Calico Host Endpoints",
    subtitle: "Manage Calico HostEndpoint resources",
    kind: "HostEndpoint",
    createFields: [{ name: "node", label: "Node", section: "Endpoint", defaultValue: "" }, { name: "interfaceName", label: "Interface Name", section: "Endpoint", defaultValue: "*" }, { name: "expectedIPs", label: "Expected IPs", section: "Endpoint", defaultValue: "", placeholder: "comma-separated IPs" }],
    buildSpec: (values) => ({ ...(stringValue(values.node) ? { node: stringValue(values.node) } : {}), interfaceName: stringValue(values.interfaceName, "*"), ...(csvList(values.expectedIPs).length ? { expectedIPs: csvList(values.expectedIPs) } : {}) }),
    statusPath: ["spec", "node"],
  }),
  calicoBGPConfigurations: calicoResourceConfig({ plural: "bgpconfigurations", path: "/networks/calico/bgp-configurations", title: "Calico BGP Configurations", subtitle: "Manage Calico BGPConfiguration resources", kind: "BGPConfiguration", createFields: [{ name: "asNumber", label: "AS Number", section: "BGP", type: "number", defaultValue: "64512" }], buildSpec: (values) => ({ asNumber: numberValue(values.asNumber, 64512) }), statusPath: ["spec", "asNumber"] }),
  calicoBGPPeers: calicoResourceConfig({ plural: "bgppeers", path: "/networks/calico/bgp-peers", title: "Calico BGP Peers", subtitle: "Manage Calico BGPPeer resources", kind: "BGPPeer", createFields: [{ name: "peerIP", label: "Peer IP", section: "BGP", defaultValue: "192.0.2.1" }, { name: "asNumber", label: "Peer AS Number", section: "BGP", type: "number", defaultValue: "64512" }], buildSpec: (values) => ({ peerIP: stringValue(values.peerIP, "192.0.2.1"), asNumber: numberValue(values.asNumber, 64512) }), statusPath: ["spec", "peerIP"] }),
  calicoBGPFilters: calicoResourceConfig({ plural: "bgpfilters", path: "/networks/calico/bgp-filters", title: "Calico BGP Filters", subtitle: "Manage Calico BGPFilter resources", kind: "BGPFilter", buildSpec: () => ({}) }),
  calicoFelixConfigurations: calicoResourceConfig({ plural: "felixconfigurations", path: "/networks/calico/felix-configurations", title: "Calico Felix Configurations", subtitle: "Manage Calico FelixConfiguration resources", kind: "FelixConfiguration", buildSpec: () => ({}) }),
  calicoKubeControllersConfigurations: calicoResourceConfig({ plural: "kubecontrollersconfigurations", path: "/networks/calico/kube-controllers-configurations", title: "Calico Kube Controllers Configurations", subtitle: "Manage Calico KubeControllersConfiguration resources", kind: "KubeControllersConfiguration", buildSpec: () => ({}) }),
  calicoIPReservations: calicoResourceConfig({ plural: "ipreservations", path: "/networks/calico/ip-reservations", title: "Calico IP Reservations", subtitle: "Manage Calico IPReservation resources", kind: "IPReservation", createFields: [{ name: "reservedCIDRs", label: "Reserved CIDRs", section: "Reservation", defaultValue: "10.244.0.10/32", placeholder: "comma-separated CIDRs" }], buildSpec: (values) => ({ reservedCIDRs: csvList(values.reservedCIDRs) }), statusPath: ["spec", "reservedCIDRs", "0"] }),
  calicoBlockAffinities: calicoResourceConfig({ plural: "blockaffinities", path: "/networks/calico/block-affinities", title: "Calico Block Affinities", subtitle: "Inspect Calico IPAM block affinity resources", kind: "BlockAffinity", allowCreate: false, allowDelete: false, statusPath: ["spec", "state"] }),
  calicoCalicoNodeStatuses: calicoResourceConfig({ plural: "caliconodestatuses", path: "/networks/calico/node-statuses", title: "Calico Node Statuses", subtitle: "Inspect CalicoNodeStatus resources", kind: "CalicoNodeStatus", allowCreate: false, allowDelete: false, statusPath: ["status", "agent", "birdV4", "state"] }),
  calicoClusterInformations: calicoResourceConfig({ plural: "clusterinformations", path: "/networks/calico/cluster-informations", title: "Calico Cluster Information", subtitle: "Inspect Calico ClusterInformation resources", kind: "ClusterInformation", allowCreate: false, allowDelete: false, statusPath: ["spec", "calicoVersion"] }),
  calicoIPAMBlocks: calicoResourceConfig({ plural: "ipamblocks", path: "/networks/calico/ipam-blocks", title: "Calico IPAM Blocks", subtitle: "Inspect Calico IPAMBlock resources", kind: "IPAMBlock", allowCreate: false, allowDelete: false, statusPath: ["spec", "cidr"] }),
  calicoIPAMConfigs: calicoResourceConfig({ plural: "ipamconfigs", path: "/networks/calico/ipam-configs", title: "Calico IPAM Configs", subtitle: "Inspect Calico IPAMConfig resources", kind: "IPAMConfig", allowCreate: false, allowDelete: false }),
  calicoIPAMHandles: calicoResourceConfig({ plural: "ipamhandles", path: "/networks/calico/ipam-handles", title: "Calico IPAM Handles", subtitle: "Inspect Calico IPAMHandle resources", kind: "IPAMHandle", allowCreate: false, allowDelete: false }),
  ciliumNetworkPolicies: {
    id: "ciliumnetworkpolicies",
    path: "/networks/cilium/network-policies",
    title: "Cilium Network Policies",
    subtitle: "Manage CiliumNetworkPolicy resources",
    listPath: "/apis/cilium.io/v2/ciliumnetworkpolicies",
    namespaced: true,
    resourcePath: "/apis/cilium.io/v2",
    kind: "CiliumNetworkPolicy",
    createFields: [
      ...namespaceNameFields("example-cilium-policy"),
      { name: "selectorKey", label: "Endpoint Selector Key", section: "Selector", defaultValue: "app" },
      { name: "selectorValue", label: "Endpoint Selector Value", section: "Selector", defaultValue: "example" },
      { name: "cidr", label: "Allowed CIDR", section: "Ingress", defaultValue: "0.0.0.0/0" },
      { name: "port", label: "TCP Port", section: "Ingress", type: "number", defaultValue: "80" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "cilium.io/v2",
      kind: "CiliumNetworkPolicy",
      metadata: { name: stringValue(values.name, "example-cilium-policy"), namespace: stringValue(values.namespace, "default") },
      spec: {
        endpointSelector: selectorFromValues(values),
        ingress: [{ fromCIDR: [stringValue(values.cidr, "0.0.0.0/0")], toPorts: [{ ports: [{ port: stringValue(values.port, "80"), protocol: "TCP" }] }] }],
      },
    }),
    statusPath: ["status", "conditions", "0", "type"],
    detailSections: (r) => [{ title: "Cilium Policy", items: [{ label: "Endpoint Selector", value: getRecord(r.spec).endpointSelector }, { label: "Ingress", value: getRecord(r.spec).ingress }, { label: "Egress", value: getRecord(r.spec).egress }, { label: "Conditions", value: getRecord(r.status).conditions }] }],
    extraColumns: [{ label: "Selector", value: (r) => selectorText(getRecord(getRecord(r.spec).endpointSelector).matchLabels) || "N/A" }],
    createTemplate: `apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: example-cilium-policy
  namespace: default
spec:
  endpointSelector: {}
`,
  },
  ciliumClusterwideNetworkPolicies: {
    id: "ciliumclusterwidenetworkpolicies",
    path: "/networks/cilium/clusterwide-network-policies",
    title: "Cilium Clusterwide Policies",
    subtitle: "Manage CiliumClusterwideNetworkPolicy resources",
    listPath: "/apis/cilium.io/v2/ciliumclusterwidenetworkpolicies",
    namespaced: false,
    resourcePath: "/apis/cilium.io/v2",
    kind: "CiliumClusterwideNetworkPolicy",
    createFields: [
      ...nameOnlyFields("example-cilium-cluster-policy"),
      { name: "selectorKey", label: "Endpoint Selector Key", section: "Selector", defaultValue: "app" },
      { name: "selectorValue", label: "Endpoint Selector Value", section: "Selector", defaultValue: "example" },
      { name: "cidr", label: "Allowed CIDR", section: "Ingress", defaultValue: "0.0.0.0/0" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "cilium.io/v2",
      kind: "CiliumClusterwideNetworkPolicy",
      metadata: { name: stringValue(values.name, "example-cilium-cluster-policy") },
      spec: { endpointSelector: selectorFromValues(values), ingress: [{ fromCIDR: [stringValue(values.cidr, "0.0.0.0/0")] }] },
    }),
    statusPath: ["status", "conditions", "0", "type"],
    detailSections: (r) => [{ title: "Cilium Clusterwide Policy", items: [{ label: "Endpoint Selector", value: getRecord(r.spec).endpointSelector }, { label: "Ingress", value: getRecord(r.spec).ingress }, { label: "Egress", value: getRecord(r.spec).egress }, { label: "Conditions", value: getRecord(r.status).conditions }] }],
    extraColumns: [{ label: "Selector", value: (r) => selectorText(getRecord(getRecord(r.spec).endpointSelector).matchLabels) || "N/A" }],
    createTemplate: `apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: example-cilium-cluster-policy
spec:
  endpointSelector: {}
`,
  },
  ciliumNodes: {
    id: "ciliumnodes",
    path: "/networks/cilium/nodes",
    title: "Cilium Nodes",
    subtitle: "Inspect CiliumNode resources",
    listPath: "/apis/cilium.io/v2/ciliumnodes",
    namespaced: false,
    resourcePath: "/apis/cilium.io/v2",
    kind: "CiliumNode",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["spec", "health", "ipv4"],
    detailSections: (r) => [{ title: "Cilium Node", items: [{ label: "Addresses", value: getRecord(r.spec).addresses }, { label: "Health", value: getRecord(r.spec).health }, { label: "IPAM", value: getRecord(r.spec).ipam }, { label: "Encryption", value: getRecord(r.spec).encryption }] }],
    extraColumns: [{ label: "Health IPv4", value: (r) => String(getRecord(getRecord(r.spec).health).ipv4 || "N/A") }],
    createTemplate: `apiVersion: cilium.io/v2
kind: CiliumNode
metadata:
  name: example-node
`,
  },
  ciliumEndpoints: ciliumResourceConfig({ plural: "ciliumendpoints", path: "/networks/cilium/endpoints", title: "Cilium Endpoints", subtitle: "Inspect CiliumEndpoint workload state", kind: "CiliumEndpoint", namespaced: true, allowCreate: false, allowDelete: false, statusPath: ["status", "state"] }),
  ciliumEndpointSlices: ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumendpointslices", path: "/networks/cilium/endpoint-slices", title: "Cilium Endpoint Slices", subtitle: "Inspect CiliumEndpointSlice resources", kind: "CiliumEndpointSlice", allowCreate: false, allowDelete: false, statusPath: ["status", "state"] }),
  ciliumIdentities: ciliumResourceConfig({ plural: "ciliumidentities", path: "/networks/cilium/identities", title: "Cilium Identities", subtitle: "Inspect CiliumIdentity resources", kind: "CiliumIdentity", allowCreate: false, allowDelete: false, statusPath: ["security-labels", "0"] }),
  ciliumEnvoyConfigs: ciliumResourceConfig({ plural: "ciliumenvoyconfigs", path: "/networks/cilium/envoy-configs", title: "Cilium Envoy Configs", subtitle: "Manage namespaced CiliumEnvoyConfig resources", kind: "CiliumEnvoyConfig", namespaced: true, buildSpec: () => ({ resources: [] }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumClusterwideEnvoyConfigs: ciliumResourceConfig({ plural: "ciliumclusterwideenvoyconfigs", path: "/networks/cilium/clusterwide-envoy-configs", title: "Cilium Clusterwide Envoy Configs", subtitle: "Manage cluster-scoped CiliumClusterwideEnvoyConfig resources", kind: "CiliumClusterwideEnvoyConfig", buildSpec: () => ({ resources: [] }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumCIDRGroups: ciliumResourceConfig({ plural: "ciliumcidrgroups", path: "/networks/cilium/cidr-groups", title: "Cilium CIDR Groups", subtitle: "Manage reusable Cilium CIDR groups", kind: "CiliumCIDRGroup", createFields: [{ name: "cidrs", label: "CIDRs", section: "CIDR", defaultValue: "10.0.0.0/8", placeholder: "comma-separated CIDRs" }], buildSpec: (values) => ({ externalCIDRs: csvList(values.cidrs) }), statusPath: ["spec", "externalCIDRs", "0"] }),
  ciliumEgressGatewayPolicies: ciliumResourceConfig({ plural: "ciliumegressgatewaypolicies", path: "/networks/cilium/egress-gateway-policies", title: "Cilium Egress Gateway Policies", subtitle: "Manage Cilium egress gateway policies", kind: "CiliumEgressGatewayPolicy", createFields: [{ name: "selectorKey", label: "Pod Selector Key", section: "Selector", defaultValue: "app" }, { name: "selectorValue", label: "Pod Selector Value", section: "Selector", defaultValue: "example" }, { name: "destinationCIDRs", label: "Destination CIDRs", section: "Destination", defaultValue: "0.0.0.0/0" }, { name: "egressGatewayNodeSelectorKey", label: "Gateway Node Selector Key", section: "Gateway", defaultValue: "kubernetes.io/hostname" }, { name: "egressGatewayNodeSelectorValue", label: "Gateway Node Selector Value", section: "Gateway", defaultValue: "" }], buildSpec: (values) => ({ selectors: [{ podSelector: selectorFromValues(values) }], destinationCIDRs: csvList(values.destinationCIDRs), egressGateway: { nodeSelector: { matchLabels: { [stringValue(values.egressGatewayNodeSelectorKey, "kubernetes.io/hostname")]: stringValue(values.egressGatewayNodeSelectorValue) } } } }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumLoadBalancerIPPools: ciliumResourceConfig({ plural: "ciliumloadbalancerippools", path: "/networks/cilium/load-balancer-ip-pools", title: "Cilium Load Balancer IP Pools", subtitle: "Manage Cilium LoadBalancer IP pools", kind: "CiliumLoadBalancerIPPool", createFields: [{ name: "cidr", label: "CIDR", section: "Pool", defaultValue: "192.0.2.0/24" }, { name: "disabled", label: "Disabled", section: "Pool", type: "checkbox", defaultValue: false }], buildSpec: (values) => ({ blocks: [{ cidr: stringValue(values.cidr, "192.0.2.0/24") }], disabled: values.disabled === true }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumLocalRedirectPolicies: ciliumResourceConfig({ plural: "ciliumlocalredirectpolicies", path: "/networks/cilium/local-redirect-policies", title: "Cilium Local Redirect Policies", subtitle: "Manage CiliumLocalRedirectPolicy resources", kind: "CiliumLocalRedirectPolicy", namespaced: true, createFields: [{ name: "selectorKey", label: "Backend Selector Key", section: "Backend", defaultValue: "app" }, { name: "selectorValue", label: "Backend Selector Value", section: "Backend", defaultValue: "example" }], buildSpec: (values) => ({ redirectBackend: { localEndpointSelector: selectorFromValues(values) } }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumL2AnnouncementPolicies: ciliumResourceConfig({ version: "v2alpha1", plural: "ciliuml2announcementpolicies", path: "/networks/cilium/l2-announcement-policies", title: "Cilium L2 Announcement Policies", subtitle: "Manage Cilium L2 announcement policies", kind: "CiliumL2AnnouncementPolicy", createFields: [{ name: "interfaces", label: "Interfaces", section: "L2", defaultValue: "", placeholder: "comma-separated; empty means all" }, { name: "externalIPs", label: "External IPs", section: "L2", type: "checkbox", defaultValue: true }, { name: "loadBalancerIPs", label: "LoadBalancer IPs", section: "L2", type: "checkbox", defaultValue: true }], buildSpec: (values) => ({ ...(csvList(values.interfaces).length ? { interfaces: csvList(values.interfaces) } : {}), externalIPs: values.externalIPs === true, loadBalancerIPs: values.loadBalancerIPs === true }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumPodIPPools: ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumpodippools", path: "/networks/cilium/pod-ip-pools", title: "Cilium Pod IP Pools", subtitle: "Manage CiliumPodIPPool resources", kind: "CiliumPodIPPool", createFields: [{ name: "cidrs", label: "CIDRs", section: "Pool", defaultValue: "10.10.0.0/16", placeholder: "comma-separated CIDRs" }], buildSpec: (values) => ({ ipv4: { cidrs: csvList(values.cidrs) } }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumGatewayClassConfigs: ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumgatewayclassconfigs", path: "/networks/cilium/gateway-class-configs", title: "Cilium Gateway Class Configs", subtitle: "Manage Cilium Gateway API class configs", kind: "CiliumGatewayClassConfig", namespaced: true, buildSpec: () => ({}), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumNodeConfigs: ciliumResourceConfig({ plural: "ciliumnodeconfigs", path: "/networks/cilium/node-configs", title: "Cilium Node Configs", subtitle: "Manage namespaced CiliumNodeConfig resources", kind: "CiliumNodeConfig", namespaced: true, buildSpec: () => ({ defaults: {} }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumDatapathPlugins: ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumdatapathplugins", path: "/networks/cilium/datapath-plugins", title: "Cilium Datapath Plugins", subtitle: "Manage Cilium datapath plugin resources", kind: "CiliumDatapathPlugin", buildSpec: () => ({}), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumBGPAdvertisements: ciliumResourceConfig({ plural: "ciliumbgpadvertisements", path: "/networks/cilium/bgp-advertisements", title: "Cilium BGP Advertisements", subtitle: "Manage Cilium BGPAdvertisement resources", kind: "CiliumBGPAdvertisement", buildSpec: () => ({ advertisements: [] }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumBGPClusterConfigs: ciliumResourceConfig({ plural: "ciliumbgpclusterconfigs", path: "/networks/cilium/bgp-cluster-configs", title: "Cilium BGP Cluster Configs", subtitle: "Manage Cilium BGPClusterConfig resources", kind: "CiliumBGPClusterConfig", buildSpec: () => ({ bgpInstances: [] }), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumBGPNodeConfigs: ciliumResourceConfig({ plural: "ciliumbgpnodeconfigs", path: "/networks/cilium/bgp-node-configs", title: "Cilium BGP Node Configs", subtitle: "Inspect Cilium BGP node config resources", kind: "CiliumBGPNodeConfig", allowCreate: false, allowDelete: false, statusPath: ["status", "conditions", "0", "type"] }),
  ciliumBGPNodeConfigOverrides: ciliumResourceConfig({ plural: "ciliumbgpnodeconfigoverrides", path: "/networks/cilium/bgp-node-config-overrides", title: "Cilium BGP Node Config Overrides", subtitle: "Manage Cilium BGP node override resources", kind: "CiliumBGPNodeConfigOverride", buildSpec: () => ({}), statusPath: ["status", "conditions", "0", "type"] }),
  ciliumBGPPeerConfigs: ciliumResourceConfig({ plural: "ciliumbgppeerconfigs", path: "/networks/cilium/bgp-peer-configs", title: "Cilium BGP Peer Configs", subtitle: "Manage Cilium BGPPeerConfig resources", kind: "CiliumBGPPeerConfig", createFields: [{ name: "peerASN", label: "Peer ASN", section: "BGP", type: "number", defaultValue: "64512" }], buildSpec: (values) => ({ families: [], timers: {}, authSecretRef: "", gracefulRestart: {}, transport: {}, ebgpMultihop: 1, peerASN: numberValue(values.peerASN, 64512) }), statusPath: ["status", "conditions", "0", "type"] }),
  kubeOvnSubnets: {
    id: "subnets",
    path: "/networks/kube-ovn/subnets",
    title: "Kube-OVN Subnets",
    subtitle: "Manage Kube-OVN Subnet resources",
    listPath: "/apis/kubeovn.io/v1/subnets",
    namespaced: false,
    resourcePath: "/apis/kubeovn.io/v1",
    kind: "Subnet",
    createFields: [
      ...nameOnlyFields("example-subnet"),
      { name: "cidrBlock", label: "CIDR Block", section: "Subnet", defaultValue: "10.16.0.0/16" },
      { name: "gateway", label: "Gateway", section: "Subnet", defaultValue: "10.16.0.1" },
      { name: "protocol", label: "Protocol", section: "Subnet", type: "select", defaultValue: "IPv4", options: [{ label: "IPv4", value: "IPv4" }, { label: "IPv6", value: "IPv6" }, { label: "Dual", value: "Dual" }] },
      { name: "vpc", label: "VPC", section: "Subnet", defaultValue: "ovn-cluster" },
      { name: "natOutgoing", label: "NAT Outgoing", section: "Subnet", type: "checkbox", defaultValue: true },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "kubeovn.io/v1",
      kind: "Subnet",
      metadata: { name: stringValue(values.name, "example-subnet") },
      spec: { cidrBlock: stringValue(values.cidrBlock, "10.16.0.0/16"), gateway: stringValue(values.gateway, "10.16.0.1"), protocol: stringValue(values.protocol, "IPv4"), vpc: stringValue(values.vpc, "ovn-cluster"), natOutgoing: values.natOutgoing === true },
    }),
    statusPath: ["status", "ready"],
    detailSections: (r) => [{ title: "Subnet", items: [{ label: "CIDR", value: getRecord(r.spec).cidrBlock }, { label: "Gateway", value: getRecord(r.spec).gateway }, { label: "VPC", value: getRecord(r.spec).vpc }, { label: "NAT Outgoing", value: getRecord(r.spec).natOutgoing }, { label: "Status", value: r.status }] }],
    extraColumns: [{ label: "CIDR", value: (r) => String(getRecord(r.spec).cidrBlock || "N/A") }, { label: "VPC", value: (r) => String(getRecord(r.spec).vpc || "N/A") }],
    createTemplate: `apiVersion: kubeovn.io/v1
kind: Subnet
metadata:
  name: example-subnet
spec:
  cidrBlock: 10.16.0.0/16
`,
  },
  kubeOvnVpcs: {
    id: "vpcs",
    path: "/networks/kube-ovn/vpcs",
    title: "Kube-OVN VPCs",
    subtitle: "Manage Kube-OVN VPC resources",
    listPath: "/apis/kubeovn.io/v1/vpcs",
    namespaced: false,
    resourcePath: "/apis/kubeovn.io/v1",
    kind: "Vpc",
    createFields: [
      ...nameOnlyFields("example-vpc"),
      { name: "namespaces", label: "Namespaces", section: "VPC", defaultValue: "", placeholder: "comma separated, optional" },
      { name: "staticRoutes", label: "Static Route CIDR", section: "Routing", defaultValue: "", placeholder: "optional" },
      { name: "nextHopIP", label: "Next Hop IP", section: "Routing", defaultValue: "", placeholder: "optional" },
    ],
    buildCreateResource: (values) => {
      const namespaces = stringValue(values.namespaces).split(",").map((item) => item.trim()).filter(Boolean);
      const staticRoutes = stringValue(values.staticRoutes) && stringValue(values.nextHopIP)
        ? [{ cidr: stringValue(values.staticRoutes), nextHopIP: stringValue(values.nextHopIP), policy: "policyDst" }]
        : [];
      return {
        apiVersion: "kubeovn.io/v1",
        kind: "Vpc",
        metadata: { name: stringValue(values.name, "example-vpc") },
        spec: { ...(namespaces.length ? { namespaces } : {}), ...(staticRoutes.length ? { staticRoutes } : {}) },
      };
    },
    statusPath: ["status", "ready"],
    detailSections: (r) => [{ title: "VPC", items: [{ label: "Namespaces", value: getRecord(r.spec).namespaces }, { label: "Static Routes", value: getRecord(r.spec).staticRoutes }, { label: "Status", value: r.status }] }],
    extraColumns: [{ label: "Namespaces", value: (r) => listNames(getRecord(r.spec).namespaces) || "N/A" }],
    createTemplate: `apiVersion: kubeovn.io/v1
kind: Vpc
metadata:
  name: example-vpc
spec: {}
`,
  },
  kubeOvnProviderNetworks: {
    id: "provider-networks",
    path: "/networks/kube-ovn/provider-networks",
    title: "Kube-OVN Provider Networks",
    subtitle: "Manage Kube-OVN ProviderNetwork resources",
    listPath: "/apis/kubeovn.io/v1/provider-networks",
    namespaced: false,
    resourcePath: "/apis/kubeovn.io/v1",
    kind: "ProviderNetwork",
    createFields: [
      ...nameOnlyFields("provider-net"),
      { name: "defaultInterface", label: "Default Interface", section: "Provider Network", defaultValue: "eth0" },
      { name: "excludeNodes", label: "Exclude Nodes", section: "Provider Network", defaultValue: "", placeholder: "comma separated, optional" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "kubeovn.io/v1",
      kind: "ProviderNetwork",
      metadata: { name: stringValue(values.name, "provider-net") },
      spec: { defaultInterface: stringValue(values.defaultInterface, "eth0"), excludeNodes: stringValue(values.excludeNodes).split(",").map((item) => item.trim()).filter(Boolean) },
    }),
    statusPath: ["status", "ready"],
    detailSections: (r) => [{ title: "Provider Network", items: [{ label: "Default Interface", value: getRecord(r.spec).defaultInterface }, { label: "Exclude Nodes", value: getRecord(r.spec).excludeNodes }, { label: "Status", value: r.status }] }],
    extraColumns: [{ label: "Interface", value: (r) => String(getRecord(r.spec).defaultInterface || "N/A") }],
    createTemplate: `apiVersion: kubeovn.io/v1
kind: ProviderNetwork
metadata:
  name: provider-net
spec:
  defaultInterface: eth0
`,
  },
  kubeOvnVlans: {
    id: "vlans",
    path: "/networks/kube-ovn/vlans",
    title: "Kube-OVN VLANs",
    subtitle: "Manage Kube-OVN Vlan resources",
    listPath: "/apis/kubeovn.io/v1/vlans",
    namespaced: false,
    resourcePath: "/apis/kubeovn.io/v1",
    kind: "Vlan",
    createFields: [
      ...nameOnlyFields("vlan100"),
      { name: "id", label: "VLAN ID", section: "VLAN", type: "number", defaultValue: "100" },
      { name: "provider", label: "Provider Network", section: "VLAN", defaultValue: "provider-net" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "kubeovn.io/v1",
      kind: "Vlan",
      metadata: { name: stringValue(values.name, "vlan100") },
      spec: { id: numberValue(values.id, 100), provider: stringValue(values.provider, "provider-net") },
    }),
    statusPath: ["spec", "id"],
    detailSections: (r) => [{ title: "VLAN", items: [{ label: "ID", value: getRecord(r.spec).id }, { label: "Provider", value: getRecord(r.spec).provider }, { label: "Status", value: r.status }] }],
    extraColumns: [{ label: "VLAN ID", value: (r) => String(getRecord(r.spec).id || "N/A") }, { label: "Provider", value: (r) => String(getRecord(r.spec).provider || "N/A") }],
    createTemplate: `apiVersion: kubeovn.io/v1
kind: Vlan
metadata:
  name: vlan100
spec:
  id: 100
  provider: provider-net
`,
  },
  kubeOvnIPPools: kubeOvnResourceConfig({
    plural: "ippools",
    path: "/networks/kube-ovn/ip-pools",
    title: "Kube-OVN IP Pools",
    subtitle: "Manage Kube-OVN IPPool resources",
    kind: "IPPool",
    createFields: [
      { name: "subnet", label: "Subnet", section: "IP Pool", defaultValue: "example-subnet" },
      { name: "ips", label: "IPs", section: "IP Pool", defaultValue: "", placeholder: "comma separated" },
    ],
    buildSpec: (values) => ({ subnet: stringValue(values.subnet), ips: csvList(values.ips) }),
    statusPath: ["spec", "subnet"],
    extraColumns: [{ label: "Subnet", value: (r) => String(getRecord(r.spec).subnet || "N/A") }],
  }),
  kubeOvnIPs: kubeOvnResourceConfig({
    plural: "ips",
    path: "/networks/kube-ovn/ips",
    title: "Kube-OVN IPs",
    subtitle: "Inspect Kube-OVN allocated IP resources",
    kind: "IP",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["spec", "subnet"],
    extraColumns: [
      { label: "Subnet", value: (r) => String(getRecord(r.spec).subnet || "N/A") },
      { label: "V4 IP", value: (r) => String(getRecord(r.spec).v4IPAddress || getRecord(r.spec).ipAddress || "N/A") },
    ],
  }),
  kubeOvnVpcNatGateways: kubeOvnResourceConfig({
    plural: "vpc-nat-gateways",
    path: "/networks/kube-ovn/vpc-nat-gateways",
    title: "Kube-OVN VPC NAT Gateways",
    subtitle: "Manage Kube-OVN VpcNatGateway resources",
    kind: "VpcNatGateway",
    createFields: [
      { name: "namespace", label: "Workload Namespace", section: "Gateway", defaultValue: "default" },
      { name: "vpc", label: "VPC", section: "Gateway", defaultValue: "ovn-cluster" },
      { name: "subnet", label: "Subnet", section: "Gateway", defaultValue: "example-subnet" },
      { name: "lanIp", label: "LAN IP", section: "Gateway", defaultValue: "", placeholder: "optional" },
      { name: "externalSubnets", label: "External Subnets", section: "Gateway", defaultValue: "", placeholder: "comma separated" },
      { name: "replicas", label: "Replicas", section: "Gateway", type: "number", defaultValue: "1" },
    ],
    buildSpec: (values) => ({
      namespace: stringValue(values.namespace, "default"),
      vpc: stringValue(values.vpc, "ovn-cluster"),
      subnet: stringValue(values.subnet, "example-subnet"),
      ...(stringValue(values.lanIp) ? { lanIp: stringValue(values.lanIp) } : {}),
      externalSubnets: csvList(values.externalSubnets),
      replicas: numberValue(values.replicas, 1),
    }),
    statusPath: ["status", "ready"],
    extraColumns: [
      { label: "VPC", value: (r) => String(getRecord(r.spec).vpc || "N/A") },
      { label: "Subnet", value: (r) => String(getRecord(r.spec).subnet || "N/A") },
    ],
  }),
  kubeOvnIptablesEIPs: kubeOvnResourceConfig({
    plural: "iptables-eips",
    path: "/networks/kube-ovn/iptables-eips",
    title: "Kube-OVN Iptables EIPs",
    subtitle: "Manage Kube-OVN IptablesEIP resources",
    kind: "IptablesEIP",
    createFields: [
      { name: "natGwDp", label: "NAT Gateway", section: "EIP", defaultValue: "vpc-nat-gw" },
      { name: "externalSubnet", label: "External Subnet", section: "EIP", defaultValue: "external-subnet" },
      { name: "v4ip", label: "IPv4", section: "EIP", defaultValue: "", placeholder: "optional" },
      { name: "macAddress", label: "MAC Address", section: "EIP", defaultValue: "", placeholder: "optional" },
      { name: "qosPolicy", label: "QoS Policy", section: "EIP", defaultValue: "", placeholder: "optional" },
    ],
    buildSpec: (values) => ({
      natGwDp: stringValue(values.natGwDp),
      externalSubnet: stringValue(values.externalSubnet),
      ...(stringValue(values.v4ip) ? { v4ip: stringValue(values.v4ip) } : {}),
      ...(stringValue(values.macAddress) ? { macAddress: stringValue(values.macAddress) } : {}),
      ...(stringValue(values.qosPolicy) ? { qosPolicy: stringValue(values.qosPolicy) } : {}),
    }),
    statusPath: ["status", "ready"],
    extraColumns: [
      { label: "External Subnet", value: (r) => String(getRecord(r.spec).externalSubnet || "N/A") },
      { label: "NAT Gateway", value: (r) => String(getRecord(r.spec).natGwDp || "N/A") },
    ],
  }),
  kubeOvnIptablesDnatRules: kubeOvnResourceConfig({
    plural: "iptables-dnat-rules",
    path: "/networks/kube-ovn/iptables-dnat-rules",
    title: "Kube-OVN Iptables DNAT Rules",
    subtitle: "Manage Kube-OVN IptablesDnatRule resources",
    kind: "IptablesDnatRule",
    createFields: [
      { name: "eip", label: "EIP", section: "DNAT", defaultValue: "example-eip" },
      { name: "externalPort", label: "External Port", section: "DNAT", defaultValue: "8080" },
      { name: "internalIp", label: "Internal IP", section: "DNAT", defaultValue: "10.16.0.10" },
      { name: "internalPort", label: "Internal Port", section: "DNAT", defaultValue: "80" },
      { name: "protocol", label: "Protocol", section: "DNAT", type: "select", defaultValue: "tcp", options: [{ label: "tcp", value: "tcp" }, { label: "udp", value: "udp" }] },
    ],
    buildSpec: (values) => ({ eip: stringValue(values.eip), externalPort: stringValue(values.externalPort), internalIp: stringValue(values.internalIp), internalPort: stringValue(values.internalPort), protocol: stringValue(values.protocol, "tcp") }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(getRecord(r.spec).eip || "N/A") }],
  }),
  kubeOvnIptablesSnatRules: kubeOvnResourceConfig({
    plural: "iptables-snat-rules",
    path: "/networks/kube-ovn/iptables-snat-rules",
    title: "Kube-OVN Iptables SNAT Rules",
    subtitle: "Manage Kube-OVN IptablesSnatRule resources",
    kind: "IptablesSnatRule",
    createFields: [
      { name: "eip", label: "EIP", section: "SNAT", defaultValue: "example-eip" },
      { name: "internalCIDR", label: "Internal CIDR", section: "SNAT", defaultValue: "10.16.0.0/24" },
    ],
    buildSpec: (values) => ({ eip: stringValue(values.eip), internalCIDR: stringValue(values.internalCIDR) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(getRecord(r.spec).eip || "N/A") }],
  }),
  kubeOvnIptablesFIPRules: kubeOvnResourceConfig({
    plural: "iptables-fip-rules",
    path: "/networks/kube-ovn/iptables-fip-rules",
    title: "Kube-OVN Iptables FIP Rules",
    subtitle: "Manage Kube-OVN IptablesFIPRule resources",
    kind: "IptablesFIPRule",
    createFields: [
      { name: "eip", label: "EIP", section: "FIP", defaultValue: "example-eip" },
      { name: "internalIp", label: "Internal IP", section: "FIP", defaultValue: "10.16.0.10" },
    ],
    buildSpec: (values) => ({ eip: stringValue(values.eip), internalIp: stringValue(values.internalIp) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(getRecord(r.spec).eip || "N/A") }],
  }),
  kubeOvnOvnEips: kubeOvnResourceConfig({
    plural: "ovn-eips",
    path: "/networks/kube-ovn/ovn-eips",
    title: "Kube-OVN OVN EIPs",
    subtitle: "Manage Kube-OVN OvnEip resources",
    kind: "OvnEip",
    createFields: [
      { name: "externalSubnet", label: "External Subnet", section: "EIP", defaultValue: "external-subnet" },
      { name: "v4ip", label: "IPv4", section: "EIP", defaultValue: "", placeholder: "optional" },
      { name: "type", label: "Type", section: "EIP", defaultValue: "", placeholder: "optional" },
    ],
    buildSpec: (values) => ({ externalSubnet: stringValue(values.externalSubnet), ...(stringValue(values.v4ip) ? { v4ip: stringValue(values.v4ip) } : {}), ...(stringValue(values.type) ? { type: stringValue(values.type) } : {}) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "External Subnet", value: (r) => String(getRecord(r.spec).externalSubnet || "N/A") }],
  }),
  kubeOvnOvnDnatRules: kubeOvnResourceConfig({
    plural: "ovn-dnat-rules",
    path: "/networks/kube-ovn/ovn-dnat-rules",
    title: "Kube-OVN OVN DNAT Rules",
    subtitle: "Manage Kube-OVN OvnDnatRule resources",
    kind: "OvnDnatRule",
    createFields: [
      { name: "eip", label: "OVN EIP", section: "DNAT", defaultValue: "example-ovn-eip" },
      { name: "externalPort", label: "External Port", section: "DNAT", defaultValue: "8080" },
      { name: "internalIp", label: "Internal IP", section: "DNAT", defaultValue: "10.16.0.10" },
      { name: "internalPort", label: "Internal Port", section: "DNAT", defaultValue: "80" },
      { name: "protocol", label: "Protocol", section: "DNAT", type: "select", defaultValue: "tcp", options: [{ label: "tcp", value: "tcp" }, { label: "udp", value: "udp" }] },
    ],
    buildSpec: (values) => ({ eip: stringValue(values.eip), externalPort: stringValue(values.externalPort), internalIp: stringValue(values.internalIp), internalPort: stringValue(values.internalPort), protocol: stringValue(values.protocol, "tcp") }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(getRecord(r.spec).eip || "N/A") }],
  }),
  kubeOvnOvnSnatRules: kubeOvnResourceConfig({
    plural: "ovn-snat-rules",
    path: "/networks/kube-ovn/ovn-snat-rules",
    title: "Kube-OVN OVN SNAT Rules",
    subtitle: "Manage Kube-OVN OvnSnatRule resources",
    kind: "OvnSnatRule",
    createFields: [
      { name: "eip", label: "OVN EIP", section: "SNAT", defaultValue: "example-ovn-eip" },
      { name: "vpcSubnet", label: "VPC Subnet", section: "SNAT", defaultValue: "10.16.0.0/24" },
    ],
    buildSpec: (values) => ({ eip: stringValue(values.eip), vpcSubnet: stringValue(values.vpcSubnet) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(getRecord(r.spec).eip || "N/A") }],
  }),
  kubeOvnOvnFips: kubeOvnResourceConfig({
    plural: "ovn-fips",
    path: "/networks/kube-ovn/ovn-fips",
    title: "Kube-OVN OVN FIPs",
    subtitle: "Manage Kube-OVN OvnFip resources",
    kind: "OvnFip",
    createFields: [
      { name: "ovnEip", label: "OVN EIP", section: "FIP", defaultValue: "example-ovn-eip" },
      { name: "ipName", label: "IP Name", section: "FIP", defaultValue: "example-ip" },
      { name: "type", label: "Type", section: "FIP", defaultValue: "", placeholder: "optional" },
    ],
    buildSpec: (values) => ({ ovnEip: stringValue(values.ovnEip), ipName: stringValue(values.ipName), ...(stringValue(values.type) ? { type: stringValue(values.type) } : {}) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "OVN EIP", value: (r) => String(getRecord(r.spec).ovnEip || "N/A") }],
  }),
  kubeOvnVips: kubeOvnResourceConfig({
    plural: "vips",
    path: "/networks/kube-ovn/vips",
    title: "Kube-OVN VIPs",
    subtitle: "Manage Kube-OVN Vip resources",
    kind: "Vip",
    createFields: [
      { name: "subnet", label: "Subnet", section: "VIP", defaultValue: "example-subnet" },
      { name: "v4ip", label: "IPv4", section: "VIP", defaultValue: "", placeholder: "optional" },
      { name: "attachSubnets", label: "Attach Subnets", section: "VIP", defaultValue: "", placeholder: "comma separated" },
    ],
    buildSpec: (values) => ({ subnet: stringValue(values.subnet), ...(stringValue(values.v4ip) ? { v4ip: stringValue(values.v4ip) } : {}), attachSubnets: csvList(values.attachSubnets) }),
    statusPath: ["spec", "subnet"],
    extraColumns: [{ label: "Subnet", value: (r) => String(getRecord(r.spec).subnet || "N/A") }],
  }),
  kubeOvnSwitchLBRules: kubeOvnResourceConfig({
    plural: "switch-lb-rules",
    path: "/networks/kube-ovn/switch-lb-rules",
    title: "Kube-OVN Switch LB Rules",
    subtitle: "Manage Kube-OVN SwitchLBRule resources",
    kind: "SwitchLBRule",
    createFields: [
      { name: "vip", label: "VIP", section: "Load Balancer", defaultValue: "10.16.0.100" },
      { name: "ports", label: "Ports", section: "Load Balancer", defaultValue: "80" },
      { name: "sessionAffinity", label: "Session Affinity", section: "Load Balancer", defaultValue: "", placeholder: "optional" },
    ],
    buildSpec: (values) => ({ vip: stringValue(values.vip), ports: csvList(values.ports), ...(stringValue(values.sessionAffinity) ? { sessionAffinity: stringValue(values.sessionAffinity) } : {}) }),
    statusPath: ["status", "service"],
    extraColumns: [{ label: "VIP", value: (r) => String(getRecord(r.spec).vip || "N/A") }],
  }),
  kubeOvnVpcDnses: kubeOvnResourceConfig({
    plural: "vpc-dnses",
    path: "/networks/kube-ovn/vpc-dnses",
    title: "Kube-OVN VPC DNS",
    subtitle: "Manage Kube-OVN VpcDns resources",
    kind: "VpcDns",
    createFields: [
      { name: "vpc", label: "VPC", section: "DNS", defaultValue: "ovn-cluster" },
      { name: "subnet", label: "Subnet", section: "DNS", defaultValue: "example-subnet" },
      { name: "replicas", label: "Replicas", section: "DNS", type: "number", defaultValue: "1" },
    ],
    buildSpec: (values) => ({ vpc: stringValue(values.vpc), subnet: stringValue(values.subnet), replicas: numberValue(values.replicas, 1) }),
    statusPath: ["status", "active"],
    extraColumns: [{ label: "VPC", value: (r) => String(getRecord(r.spec).vpc || "N/A") }, { label: "Subnet", value: (r) => String(getRecord(r.spec).subnet || "N/A") }],
  }),
  kubeOvnVpcEgressGateways: kubeOvnResourceConfig({
    plural: "vpc-egress-gateways",
    path: "/networks/kube-ovn/vpc-egress-gateways",
    title: "Kube-OVN VPC Egress Gateways",
    subtitle: "Manage Kube-OVN VpcEgressGateway resources",
    kind: "VpcEgressGateway",
    namespaced: true,
    createFields: [
      { name: "vpc", label: "VPC", section: "Gateway", defaultValue: "ovn-cluster" },
      { name: "externalSubnet", label: "External Subnet", section: "Gateway", defaultValue: "external-subnet" },
      { name: "internalSubnet", label: "Internal Subnet", section: "Gateway", defaultValue: "example-subnet" },
      { name: "replicas", label: "Replicas", section: "Gateway", type: "number", defaultValue: "1" },
    ],
    buildSpec: (values) => ({ vpc: stringValue(values.vpc), externalSubnet: stringValue(values.externalSubnet), internalSubnet: stringValue(values.internalSubnet), replicas: numberValue(values.replicas, 1) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "External Subnet", value: (r) => String(getRecord(r.spec).externalSubnet || "N/A") }],
  }),
  kubeOvnQoSPolicies: kubeOvnResourceConfig({
    plural: "qos-policies",
    path: "/networks/kube-ovn/qos-policies",
    title: "Kube-OVN QoS Policies",
    subtitle: "Manage Kube-OVN QoSPolicy resources",
    kind: "QoSPolicy",
    createFields: [
      { name: "bandwidthLimitRules", label: "Bandwidth Limit Rules", section: "QoS", type: "textarea", defaultValue: "", placeholder: "advanced YAML/JSON-like values can be edited in manifest after create" },
    ],
    buildSpec: () => ({}),
    statusPath: ["status", "shared"],
  }),
  kubeOvnSecurityGroups: kubeOvnResourceConfig({
    plural: "security-groups",
    path: "/networks/kube-ovn/security-groups",
    title: "Kube-OVN Security Groups",
    subtitle: "Manage Kube-OVN SecurityGroup resources",
    kind: "SecurityGroup",
    createFields: [
      { name: "allowSameGroupTraffic", label: "Allow Same Group Traffic", section: "Security Group", type: "checkbox", defaultValue: true },
      { name: "ingressRules", label: "Ingress Rules", section: "Security Group", type: "textarea", defaultValue: "", placeholder: "edit detailed rules in manifest" },
    ],
    buildSpec: (values) => ({ allowSameGroupTraffic: values.allowSameGroupTraffic === true }),
    statusPath: ["status", "allowSameGroupTraffic"],
  }),
  kubeOvnBgpConfs: kubeOvnResourceConfig({ plural: "bgp-confs", path: "/networks/kube-ovn/bgp-confs", title: "Kube-OVN BGP Configs", subtitle: "Manage Kube-OVN BgpConf resources", kind: "BgpConf", buildSpec: () => ({}), statusPath: ["status", "active"] }),
  kubeOvnEvpnConfs: kubeOvnResourceConfig({ plural: "evpn-confs", path: "/networks/kube-ovn/evpn-confs", title: "Kube-OVN EVPN Configs", subtitle: "Manage Kube-OVN EvpnConf resources", kind: "EvpnConf", buildSpec: () => ({}), statusPath: ["status", "active"] }),
  kubeOvnDNSNameResolvers: kubeOvnResourceConfig({
    plural: "dnsnameresolvers",
    path: "/networks/kube-ovn/dns-name-resolvers",
    title: "Kube-OVN DNS Name Resolvers",
    subtitle: "Manage Kube-OVN DNSNameResolver resources",
    kind: "DNSNameResolver",
    createFields: [
      { name: "names", label: "DNS Names", section: "Resolver", defaultValue: "example.com", placeholder: "comma separated" },
    ],
    buildSpec: (values) => ({ names: csvList(values.names) }),
    statusPath: ["status", "resolved"],
  }),
  horizontalpodautoscalers: {
    id: "horizontalpodautoscalers",
    path: "/autoscaling",
    title: "Autoscaling",
    subtitle: "Manage autoscaling policies for VM pools and related workloads",
    listPath: "/apis/autoscaling/v2/horizontalpodautoscalers",
    namespaced: true,
    resourcePath: "/apis/autoscaling/v2",
    kind: "HorizontalPodAutoscaler",
    actions: hpaActions,
    createFields: [
      ...namespaceNameFields("example-hpa"),
      { name: "targetKind", label: "Target Kind", type: "select", defaultValue: "VirtualMachinePool", options: [{ label: "VirtualMachinePool", value: "VirtualMachinePool" }, { label: "Deployment", value: "Deployment" }] },
      { name: "targetName", label: "Target Name", defaultValue: "example-pool" },
      { name: "minReplicas", label: "Min Replicas", type: "number", defaultValue: "1" },
      { name: "maxReplicas", label: "Max Replicas", type: "number", defaultValue: "3" },
      { name: "cpu", label: "CPU Utilization", type: "number", defaultValue: "80" },
    ],
    buildCreateResource: (values) => {
      const targetKind = stringValue(values.targetKind, "VirtualMachinePool");
      return {
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        metadata: { name: stringValue(values.name, "example-hpa"), namespace: stringValue(values.namespace, "default"), labels: { "kubevirt-manager.io/managed": "true" } },
        spec: {
          minReplicas: numberValue(values.minReplicas, 1),
          maxReplicas: numberValue(values.maxReplicas, 3),
          scaleTargetRef: {
            apiVersion: targetKind === "Deployment" ? "apps/v1" : "pool.kubevirt.io/v1alpha1",
            kind: targetKind,
            name: stringValue(values.targetName, "example-pool"),
          },
          metrics: [{ type: "Resource", resource: { name: "cpu", target: { type: "Utilization", averageUtilization: numberValue(values.cpu, 80) } } }],
        },
      };
    },
    detailSections: (r) => {
      const spec = getRecord(r.spec);
      const status = getRecord(r.status);
      return [
        {
          title: "Scale Target",
          items: [
            { label: "Target API Version", value: getRecord(spec.scaleTargetRef).apiVersion },
            { label: "Target Kind", value: getRecord(spec.scaleTargetRef).kind },
            { label: "Target Name", value: getRecord(spec.scaleTargetRef).name },
          ],
        },
        {
          title: "Replicas",
          items: [
            { label: "Min", value: spec.minReplicas },
            { label: "Max", value: spec.maxReplicas },
            { label: "Current", value: status.currentReplicas },
            { label: "Desired", value: status.desiredReplicas },
          ],
        },
      ];
    },
    statusPath: ["status", "currentReplicas"],
    extraColumns: [
      { label: "Min", value: (r) => String((r.spec?.minReplicas as number | undefined) ?? "N/A") },
      { label: "Max", value: (r) => String((r.spec?.maxReplicas as number | undefined) ?? "N/A") },
    ],
    createTemplate: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: example-hpa
  namespace: default
spec:
  minReplicas: 1
  maxReplicas: 3
  scaleTargetRef:
    apiVersion: pool.kubevirt.io/v1alpha1
    kind: VirtualMachinePool
    name: example-pool
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
`,
  },
}

// --- Types ---
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
                    <Link to={`/vms/${vm.metadata.namespace}/${vm.metadata.name}/overview`} className="font-semibold text-primary hover:underline">{vm.metadata.name}</Link>
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
                    <Link to={`/dvs/${dv.metadata.namespace}/${dv.metadata.name}/overview`} className="font-semibold text-primary hover:underline">{dv.metadata.name}</Link>
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
  const [data, setData] = useState<{ vms: VM[], vmis: VMI[], dvs: DV[], nodes: K8sNode[], kvPods: K8sPod[], loading: boolean }>({ vms: [], vmis: [], dvs: [], nodes: [], kvPods: [], loading: true });
  useEffect(() => {
    const load = async () => {
      try {
        const [vmsR, vmisR, dvsR, nodesR, podsR] = await Promise.all([ apiFetch("/api/v1/vms").then(r => r.json()), apiFetch("/apis/kubevirt.io/v1/virtualmachineinstances").then(r => r.json()), apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()), apiFetch("/api/v1/nodes").then(r => r.json()), apiFetch("/api/v1/namespaces/kubevirt/pods").then(r => r.json()) ]);
        setData({ vms: vmsR.items || [], vmis: vmisR.items || [], dvs: dvsR.items || [], nodes: nodesR.items || [], kvPods: podsR.items || [], loading: false });
      } catch (e) { setData(prev => ({ ...prev, loading: false })); }
    }; load();
  }, []);
  const nodeStats = useMemo(() => { const total = data.nodes.length; const unschedulable = data.nodes.filter(n => n.spec.unschedulable).length; const ready = data.nodes.filter(n => n.status.conditions.some(c => c.type === "Ready" && c.status === "True")).length; return { total, unschedulable, ready }; }, [data.nodes]);
  const nsAnalysis = useMemo(() => { const analysis: Record<string, { vmCount: number, storageGi: number }> = {}; data.vms.forEach(vm => { const ns = vm.metadata.namespace; if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 }; analysis[ns].vmCount++; }); data.dvs.forEach(dv => { const ns = dv.metadata.namespace; if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 }; const requested = dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage; analysis[ns].storageGi += parseStorage(requested); }); return Object.entries(analysis).sort((a, b) => b[1].vmCount - a[1].vmCount).map(([name, stats]) => ({ name, ...stats })); }, [data.vms, data.dvs]);
  const infraHealth = useMemo(() => { const components = ["virt-api", "virt-controller", "virt-handler"]; return components.map(c => { const pods = data.kvPods.filter(p => p.metadata.name.startsWith(c)); const healthy = pods.length > 0 && pods.every(p => p.status.phase === "Running"); return { name: c, healthy, count: pods.length }; }); }, [data.kvPods]);
  const totalStorage = nsAnalysis.reduce((acc, curr) => acc + curr.storageGi, 0);

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
        <p className="text-sm text-muted-foreground">KubeVirt infrastructure overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      else if (strat === "pod") { const ps = await apiFetch(`/api/v1/namespaces/${namespace}/pods?labelSelector=kubevirt.io/domain=${name}`); if (ps.ok) { const pod = (await ps.json()).items?.[0]; if (pod) { const pm = await apiFetch(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${pod.metadata.name}`); if (pm.ok) { const d = await pm.json(); const cpu = d.containers?.[0]?.usage?.cpu || "0n"; const mem = d.containers?.[0]?.usage?.memory || "0Ki"; const pCpu = (c:string) => c.endsWith("n") ? parseInt(c)/1e9 : c.endsWith("u") ? parseInt(c)/1e6 : c.endsWith("m") ? parseInt(c)/1e3 : parseInt(c); const pMem = (m:string) => m.endsWith("Ki") ? parseInt(m)/1024 : m.endsWith("Mi") ? parseInt(m) : m.endsWith("Gi") ? parseInt(m)*1024 : parseInt(m)/(1024*1024); setMetrics(p => [...p.slice(-19), { timestamp: Date.now(), time: new Date().toISOString(), cpuUsage: pCpu(cpu), memoryUsage: pMem(mem) }]); } } } }
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/vms")}>
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
            onDone={() => navigate("/vms")}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <Link
            key={t.id}
            to={`/vms/${namespace}/${name}/${t.id}`}
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
                        <Link to={`/dvs/${d.metadata.namespace}/${d.metadata.name}/overview`} className="font-medium hover:text-primary transition-colors flex-1">{d.metadata.name}</Link>
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
          onDone={() => navigate("/dvs")}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <Link
            key={t.id}
            to={`/dvs/${namespace}/${name}/${t.id}`}
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

type NetworkResourceGroup = {
  slug: string;
  title: string;
  description: string;
  resources: ResourceConfig[];
};

const networkResourceGroups: NetworkResourceGroup[] = [
  {
    slug: "kubernetes",
    title: "Kubernetes",
    description: "Core Service, Endpoint, Ingress, NetworkPolicy, IngressClass, and Multus resources.",
    resources: [
      resourceConfigs.kubernetesServices,
      resourceConfigs.endpoints,
      resourceConfigs.endpointSlices,
      resourceConfigs["network-attachment-definitions"],
      resourceConfigs.networkpolicies,
      resourceConfigs.ingresses,
      resourceConfigs.ingressClasses,
    ],
  },
  {
    slug: "gateway-api",
    title: "Gateway API",
    description: "GatewayClass, Gateway, and HTTPRoute routing resources.",
    resources: [
      resourceConfigs.gatewayclasses,
      resourceConfigs.gateways,
      resourceConfigs.httproutes,
    ],
  },
  {
    slug: "calico",
    title: "Calico",
    description: "Calico policy, BGP, IPAM, host endpoint, tier, and controller resources.",
    resources: [
      resourceConfigs.calicoNetworkPolicies,
      resourceConfigs.calicoGlobalNetworkPolicies,
      resourceConfigs.calicoIPPools,
      resourceConfigs.calicoTiers,
      resourceConfigs.calicoNetworkSets,
      resourceConfigs.calicoGlobalNetworkSets,
      resourceConfigs.calicoStagedNetworkPolicies,
      resourceConfigs.calicoStagedGlobalNetworkPolicies,
      resourceConfigs.calicoStagedKubernetesNetworkPolicies,
      resourceConfigs.calicoHostEndpoints,
      resourceConfigs.calicoBGPConfigurations,
      resourceConfigs.calicoBGPPeers,
      resourceConfigs.calicoBGPFilters,
      resourceConfigs.calicoFelixConfigurations,
      resourceConfigs.calicoKubeControllersConfigurations,
      resourceConfigs.calicoIPReservations,
      resourceConfigs.calicoBlockAffinities,
      resourceConfigs.calicoCalicoNodeStatuses,
      resourceConfigs.calicoClusterInformations,
      resourceConfigs.calicoIPAMBlocks,
      resourceConfigs.calicoIPAMConfigs,
      resourceConfigs.calicoIPAMHandles,
    ],
  },
  {
    slug: "cilium",
    title: "Cilium",
    description: "Cilium policy, endpoint, BGP, Envoy, IP pool, egress, L2, and Gateway resources.",
    resources: [
      resourceConfigs.ciliumNetworkPolicies,
      resourceConfigs.ciliumClusterwideNetworkPolicies,
      resourceConfigs.ciliumNodes,
      resourceConfigs.ciliumEndpoints,
      resourceConfigs.ciliumEndpointSlices,
      resourceConfigs.ciliumIdentities,
      resourceConfigs.ciliumEnvoyConfigs,
      resourceConfigs.ciliumClusterwideEnvoyConfigs,
      resourceConfigs.ciliumCIDRGroups,
      resourceConfigs.ciliumEgressGatewayPolicies,
      resourceConfigs.ciliumLoadBalancerIPPools,
      resourceConfigs.ciliumLocalRedirectPolicies,
      resourceConfigs.ciliumL2AnnouncementPolicies,
      resourceConfigs.ciliumPodIPPools,
      resourceConfigs.ciliumGatewayClassConfigs,
      resourceConfigs.ciliumNodeConfigs,
      resourceConfigs.ciliumDatapathPlugins,
      resourceConfigs.ciliumBGPAdvertisements,
      resourceConfigs.ciliumBGPClusterConfigs,
      resourceConfigs.ciliumBGPNodeConfigs,
      resourceConfigs.ciliumBGPNodeConfigOverrides,
      resourceConfigs.ciliumBGPPeerConfigs,
    ],
  },
  {
    slug: "kube-ovn",
    title: "Kube-OVN",
    description: "Kube-OVN subnet, VPC, NAT, egress, IP, policy, and provider network resources.",
    resources: [
      resourceConfigs.kubeOvnSubnets,
      resourceConfigs.kubeOvnVpcs,
      resourceConfigs.kubeOvnProviderNetworks,
      resourceConfigs.kubeOvnVlans,
      resourceConfigs.kubeOvnIPPools,
      resourceConfigs.kubeOvnIPs,
      resourceConfigs.kubeOvnVpcNatGateways,
      resourceConfigs.kubeOvnIptablesEIPs,
      resourceConfigs.kubeOvnIptablesDnatRules,
      resourceConfigs.kubeOvnIptablesSnatRules,
      resourceConfigs.kubeOvnIptablesFIPRules,
      resourceConfigs.kubeOvnOvnEips,
      resourceConfigs.kubeOvnOvnDnatRules,
      resourceConfigs.kubeOvnOvnSnatRules,
      resourceConfigs.kubeOvnOvnFips,
      resourceConfigs.kubeOvnVips,
      resourceConfigs.kubeOvnSwitchLBRules,
      resourceConfigs.kubeOvnVpcDnses,
      resourceConfigs.kubeOvnVpcEgressGateways,
      resourceConfigs.kubeOvnQoSPolicies,
      resourceConfigs.kubeOvnSecurityGroups,
      resourceConfigs.kubeOvnBgpConfs,
      resourceConfigs.kubeOvnEvpnConfs,
      resourceConfigs.kubeOvnDNSNameResolvers,
    ],
  },
];

function NetworkManagementPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Networks</h1>
        <p className="text-sm text-muted-foreground">Choose a network provider or API group before managing concrete resources.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {networkResourceGroups.map((group) => (
          <Link key={group.slug} to={`/networks/${group.slug}`} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{group.title}</CardTitle>
                  </div>
                  <Badge variant="outline">{group.resources.length}</Badge>
                </div>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NetworkCategoryPage() {
  const { category } = useParams();
  const group = networkResourceGroups.find((item) => item.slug === category);

  if (!group) {
    return <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-12">Network category not found</div>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/networks" className="hover:text-primary">Networks</Link>
            <span>/</span>
            <span>{group.title}</span>
          </div>
          <h1 className="text-2xl font-bold">{group.title}</h1>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.resources.map((config) => (
          <Link key={config.path} to={config.path} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{config.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{config.subtitle}</CardDescription>
                  </div>
                  <Badge variant="outline">{config.namespaced ? "Namespaced" : "Cluster"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">{config.kind}</div>
              </CardContent>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
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
              <Route path="/vms" element={<VMList />} />
              <Route path="/vms/:namespace/:name" element={<Navigate to="overview" replace />} />
              <Route path="/vms/:namespace/:name/:tab" element={<VMDetailContent />} />
              <Route path="/dvs" element={<DVList />} />
              <Route path="/dvs/:namespace/:name" element={<Navigate to="overview" replace />} />
              <Route path="/dvs/:namespace/:name/:tab" element={<DVDetailContent />} />
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
