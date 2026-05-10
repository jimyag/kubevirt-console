import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";
import {
  kubernetesConfigMapDetailSections,
  kubernetesCronJobDetailSections,
  kubernetesCustomResourceDefinitionDetailSections,
  kubernetesDaemonSetDetailSections,
  kubernetesDeploymentDetailSections,
  kubernetesEventDetailSections,
  kubernetesJobDetailSections,
  kubernetesNamespaceDetailSections,
  kubernetesPodDetailSections,
  kubernetesPodDisruptionBudgetDetailSections,
  kubernetesReplicaSetDetailSections,
  kubernetesRoleBindingDetailSections,
  kubernetesRoleDetailSections,
  kubernetesSecretDetailSections,
  kubernetesServiceAccountDetailSections,
  kubernetesStatefulSetDetailSections,
} from "../kubernetes/detail-sections";

const labelsFromValues = (values: Record<string, string | boolean>) => ({
  [shared.stringValue(values.labelKey, "app")]: shared.stringValue(values.labelValue, shared.stringValue(values.name, "example")),
});

const containerFromValues = (values: Record<string, string | boolean>) => ({
  name: shared.stringValue(values.containerName, "app"),
  image: shared.stringValue(values.image, "nginx:latest"),
  ports: shared.numberValue(values.containerPort, 0) > 0 ? [{ containerPort: shared.numberValue(values.containerPort, 80) }] : undefined,
});

const podTemplate = (values: Record<string, string | boolean>) => ({
  metadata: { labels: labelsFromValues(values) },
  spec: {
    serviceAccountName: shared.stringValue(values.serviceAccountName),
    containers: [containerFromValues(values)],
  },
});

const workloadFields = [
  { name: "replicas", label: "Replicas", section: "Scale", type: "number" as const, defaultValue: "1" },
  { name: "labelKey", label: "Selector Key", section: "Selector", defaultValue: "app" },
  { name: "labelValue", label: "Selector Value", section: "Selector", defaultValue: "example" },
  { name: "containerName", label: "Container Name", section: "Container", defaultValue: "app" },
  { name: "image", label: "Image", section: "Container", defaultValue: "nginx:latest" },
  { name: "containerPort", label: "Container Port", section: "Container", type: "number" as const, defaultValue: "80" },
  { name: "serviceAccountName", label: "Service Account", section: "Pod", defaultValue: "" },
];

const namedCoreResource = ({
  id,
  path,
  title,
  subtitle,
  kind,
  namespaced,
  detailSections,
  statusPath,
  extraColumns = [],
  createFields = [],
  buildResource,
  allowCreate,
  allowDelete,
}: {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  kind: string;
  namespaced: boolean;
  detailSections?: ResourceConfig["detailSections"];
  statusPath?: string[];
  extraColumns?: ResourceConfig["extraColumns"];
  createFields?: ResourceConfig["createFields"];
  buildResource?: ResourceConfig["buildCreateResource"];
  allowCreate?: boolean;
  allowDelete?: boolean;
}): ResourceConfig => ({
  id,
  path,
  title,
  subtitle,
  listPath: `/api/v1/${id}`,
  namespaced,
  resourcePath: "/api/v1",
  kind,
  allowCreate,
  allowDelete,
  createFields: [
    ...(namespaced ? shared.namespaceNameFields(`example-${id}`) : shared.nameOnlyFields(`example-${id}`)),
    ...(createFields || []),
  ],
  buildCreateResource: buildResource,
  detailSections,
  statusPath,
  extraColumns,
  createTemplate: `apiVersion: v1
kind: ${kind}
metadata:
  name: example-${id}
${namespaced ? "  namespace: default\n" : ""}`,
});

const extensionResource = ({
  groupVersion,
  id,
  path,
  title,
  subtitle,
  kind,
  namespaced,
  detailSections,
  statusPath,
  extraColumns = [],
  createFields = [],
  buildResource,
  allowCreate,
  allowDelete,
  listPathAlternates,
  resourcePathAlternates,
}: {
  groupVersion: string;
  id: string;
  path: string;
  title: string;
  subtitle: string;
  kind: string;
  namespaced: boolean;
  detailSections?: ResourceConfig["detailSections"];
  statusPath?: string[];
  extraColumns?: ResourceConfig["extraColumns"];
  createFields?: ResourceConfig["createFields"];
  buildResource?: ResourceConfig["buildCreateResource"];
  allowCreate?: boolean;
  allowDelete?: boolean;
  listPathAlternates?: string[];
  resourcePathAlternates?: string[];
}): ResourceConfig => ({
  id,
  path,
  title,
  subtitle,
  listPath: `/apis/${groupVersion}/${id}`,
  listPathAlternates,
  namespaced,
  resourcePath: `/apis/${groupVersion}`,
  resourcePathAlternates,
  kind,
  allowCreate,
  allowDelete,
  createFields: [
    ...(namespaced ? shared.namespaceNameFields(`example-${id}`) : shared.nameOnlyFields(`example-${id}`)),
    ...(createFields || []),
  ],
  buildCreateResource: buildResource,
  detailSections,
  statusPath,
  extraColumns,
  createTemplate: `apiVersion: ${groupVersion}
kind: ${kind}
metadata:
  name: example-${id}
${namespaced ? "  namespace: default\n" : ""}spec: {}
`,
});

export const podsConfig = namedCoreResource({
  id: "pods",
  path: "/kubernetes/workloads/pods",
  title: "Pods",
  subtitle: "Manage Kubernetes Pods and inspect container status, scheduling, volumes, and networking",
  kind: "Pod",
  namespaced: true,
  statusPath: ["status", "phase"],
  detailSections: kubernetesPodDetailSections,
  createFields: workloadFields.filter((field) => field.name !== "replicas"),
  buildResource: (values) => ({
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name: shared.stringValue(values.name, "example-pod"), namespace: shared.stringValue(values.namespace, "default"), labels: labelsFromValues(values) },
    spec: { serviceAccountName: shared.stringValue(values.serviceAccountName), containers: [containerFromValues(values)] },
  }),
  extraColumns: [
    { label: "Ready", value: (r) => `${(Array.isArray(r.status?.containerStatuses) ? r.status?.containerStatuses : []).filter((s: any) => s.ready).length} / ${(Array.isArray(r.status?.containerStatuses) ? r.status?.containerStatuses : []).length}` },
    { label: "Restarts", value: (r) => String((Array.isArray(r.status?.containerStatuses) ? r.status?.containerStatuses : []).reduce((sum: number, s: any) => sum + Number(s.restartCount || 0), 0)) },
    { label: "Node", value: (r) => String(shared.getRecord(r.spec).nodeName || "N/A") },
    { label: "Pod IP", value: (r) => String(shared.getRecord(r.status).podIP || "N/A") },
  ],
});

export const deploymentsConfig = extensionResource({
  groupVersion: "apps/v1",
  id: "deployments",
  path: "/kubernetes/workloads/deployments",
  title: "Deployments",
  subtitle: "Manage Deployment rollout, replica, selector, and pod template configuration",
  kind: "Deployment",
  namespaced: true,
  statusPath: ["status", "conditions", "0", "type"],
  detailSections: kubernetesDeploymentDetailSections,
  createFields: workloadFields,
  buildResource: (values) => ({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: shared.stringValue(values.name, "example-deployment"), namespace: shared.stringValue(values.namespace, "default") },
    spec: { replicas: shared.numberValue(values.replicas, 1), selector: { matchLabels: labelsFromValues(values) }, template: podTemplate(values) },
  }),
  extraColumns: [
    { label: "Ready", value: (r) => `${shared.getRecord(r.status).readyReplicas || 0} / ${shared.getRecord(r.status).replicas || shared.getRecord(r.spec).replicas || 0}` },
    { label: "Available", value: (r) => String(shared.getRecord(r.status).availableReplicas || 0) },
    { label: "Updated", value: (r) => String(shared.getRecord(r.status).updatedReplicas || 0) },
  ],
});

export const statefulsetsConfig = extensionResource({
  groupVersion: "apps/v1",
  id: "statefulsets",
  path: "/kubernetes/workloads/statefulsets",
  title: "StatefulSets",
  subtitle: "Manage StatefulSet identity, ordered rollout, and volume claim templates",
  kind: "StatefulSet",
  namespaced: true,
  statusPath: ["status", "conditions", "0", "type"],
  detailSections: kubernetesStatefulSetDetailSections,
  createFields: [...workloadFields, { name: "serviceName", label: "Headless Service Name", section: "StatefulSet", defaultValue: "" }],
  buildResource: (values) => ({
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    metadata: { name: shared.stringValue(values.name, "example-statefulset"), namespace: shared.stringValue(values.namespace, "default") },
    spec: { serviceName: shared.stringValue(values.serviceName, shared.stringValue(values.name, "example-statefulset")), replicas: shared.numberValue(values.replicas, 1), selector: { matchLabels: labelsFromValues(values) }, template: podTemplate(values) },
  }),
  extraColumns: [{ label: "Ready", value: (r) => `${shared.getRecord(r.status).readyReplicas || 0} / ${shared.getRecord(r.status).replicas || shared.getRecord(r.spec).replicas || 0}` }],
});

export const daemonsetsConfig = extensionResource({
  groupVersion: "apps/v1",
  id: "daemonsets",
  path: "/kubernetes/workloads/daemonsets",
  title: "DaemonSets",
  subtitle: "Manage DaemonSet node-wide pod rollout and availability",
  kind: "DaemonSet",
  namespaced: true,
  statusPath: ["status", "conditions", "0", "type"],
  detailSections: kubernetesDaemonSetDetailSections,
  createFields: workloadFields.filter((field) => field.name !== "replicas"),
  buildResource: (values) => ({
    apiVersion: "apps/v1",
    kind: "DaemonSet",
    metadata: { name: shared.stringValue(values.name, "example-daemonset"), namespace: shared.stringValue(values.namespace, "default") },
    spec: { selector: { matchLabels: labelsFromValues(values) }, template: podTemplate(values) },
  }),
  extraColumns: [
    { label: "Desired", value: (r) => String(shared.getRecord(r.status).desiredNumberScheduled || 0) },
    { label: "Ready", value: (r) => String(shared.getRecord(r.status).numberReady || 0) },
    { label: "Available", value: (r) => String(shared.getRecord(r.status).numberAvailable || 0) },
  ],
});

export const replicasetsConfig = extensionResource({
  groupVersion: "apps/v1",
  id: "replicasets",
  path: "/kubernetes/workloads/replicasets",
  title: "ReplicaSets",
  subtitle: "Inspect ReplicaSet ownership, selectors, and pod template state",
  kind: "ReplicaSet",
  namespaced: true,
  allowCreate: false,
  statusPath: ["status", "conditions", "0", "type"],
  detailSections: kubernetesReplicaSetDetailSections,
  extraColumns: [{ label: "Ready", value: (r) => `${shared.getRecord(r.status).readyReplicas || 0} / ${shared.getRecord(r.status).replicas || 0}` }],
});

export const jobsConfig = extensionResource({
  groupVersion: "batch/v1",
  id: "jobs",
  path: "/kubernetes/workloads/jobs",
  title: "Jobs",
  subtitle: "Manage one-shot Kubernetes Jobs and completion status",
  kind: "Job",
  namespaced: true,
  statusPath: ["status", "conditions", "0", "type"],
  detailSections: kubernetesJobDetailSections,
  createFields: workloadFields.filter((field) => field.name !== "replicas"),
  buildResource: (values) => ({
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: { name: shared.stringValue(values.name, "example-job"), namespace: shared.stringValue(values.namespace, "default") },
    spec: { template: podTemplate(values), backoffLimit: 3 },
  }),
  extraColumns: [{ label: "Succeeded", value: (r) => String(shared.getRecord(r.status).succeeded || 0) }, { label: "Failed", value: (r) => String(shared.getRecord(r.status).failed || 0) }],
});

export const cronjobsConfig = extensionResource({
  groupVersion: "batch/v1",
  id: "cronjobs",
  path: "/kubernetes/workloads/cronjobs",
  title: "CronJobs",
  subtitle: "Manage scheduled Kubernetes Jobs",
  kind: "CronJob",
  namespaced: true,
  statusPath: ["spec", "schedule"],
  detailSections: kubernetesCronJobDetailSections,
  createFields: [...workloadFields.filter((field) => field.name !== "replicas"), { name: "schedule", label: "Schedule", section: "Cron", defaultValue: "*/5 * * * *" }],
  buildResource: (values) => ({
    apiVersion: "batch/v1",
    kind: "CronJob",
    metadata: { name: shared.stringValue(values.name, "example-cronjob"), namespace: shared.stringValue(values.namespace, "default") },
    spec: { schedule: shared.stringValue(values.schedule, "*/5 * * * *"), jobTemplate: { spec: { template: podTemplate(values) } } },
  }),
  extraColumns: [{ label: "Schedule", value: (r) => String(shared.getRecord(r.spec).schedule || "N/A") }, { label: "Suspend", value: (r) => String(shared.getRecord(r.spec).suspend || false) }],
});

export const configmapsConfig = namedCoreResource({
  id: "configmaps",
  path: "/kubernetes/config/configmaps",
  title: "ConfigMaps",
  subtitle: "Manage non-sensitive key/value configuration data",
  kind: "ConfigMap",
  namespaced: true,
  detailSections: kubernetesConfigMapDetailSections,
  createFields: [...shared.namespaceNameFields("example-config").slice(2), { name: "data", label: "Data", section: "Data", type: "textarea", defaultValue: "key=value" }],
  buildResource: (values) => ({ apiVersion: "v1", kind: "ConfigMap", metadata: { name: shared.stringValue(values.name, "example-config"), namespace: shared.stringValue(values.namespace, "default") }, data: shared.parseKeyValueText(String(values.data || "")) }),
  extraColumns: [{ label: "Keys", value: (r) => String(Object.keys((r as any).data || {}).length) }],
});

export const kubernetesSecretsConfig = namedCoreResource({
  id: "secrets",
  path: "/kubernetes/config/secrets",
  title: "Secrets",
  subtitle: "Manage Kubernetes Secret metadata and keys",
  kind: "Secret",
  namespaced: true,
  detailSections: kubernetesSecretDetailSections,
  createFields: [{ name: "type", label: "Type", section: "Secret", defaultValue: "Opaque" }, { name: "stringData", label: "String Data", section: "Data", type: "textarea", defaultValue: "key=value" }],
  buildResource: (values) => ({ apiVersion: "v1", kind: "Secret", metadata: { name: shared.stringValue(values.name, "example-secret"), namespace: shared.stringValue(values.namespace, "default") }, type: shared.stringValue(values.type, "Opaque"), stringData: shared.parseKeyValueText(String(values.stringData || "")) }),
  extraColumns: [{ label: "Type", value: (r) => String((r as any).type || "Opaque") }, { label: "Keys", value: (r) => String(Object.keys((r as any).data || {}).length) }],
});

export const namespacesConfig = namedCoreResource({
  id: "namespaces",
  path: "/kubernetes/cluster/namespaces",
  title: "Namespaces",
  subtitle: "Manage Kubernetes namespaces and lifecycle state",
  kind: "Namespace",
  namespaced: false,
  statusPath: ["status", "phase"],
  detailSections: kubernetesNamespaceDetailSections,
  buildResource: (values) => ({ apiVersion: "v1", kind: "Namespace", metadata: { name: shared.stringValue(values.name, "example-namespace") } }),
  extraColumns: [{ label: "Phase", value: (r) => String(shared.getRecord(r.status).phase || "N/A") }],
});

export const eventsConfig = namedCoreResource({
  id: "events",
  path: "/kubernetes/cluster/events",
  title: "Events",
  subtitle: "Inspect Kubernetes events across namespaces",
  kind: "Event",
  namespaced: true,
  allowCreate: false,
  allowDelete: false,
  statusPath: ["type"],
  detailSections: kubernetesEventDetailSections,
  extraColumns: [
    { label: "Type", value: (r) => String((r as any).type || "N/A") },
    { label: "Reason", value: (r) => String((r as any).reason || "N/A") },
    { label: "Object", value: (r) => `${shared.getRecord((r as any).involvedObject).kind || ""}/${shared.getRecord((r as any).involvedObject).name || ""}` },
    { label: "Count", value: (r) => String((r as any).count || 1) },
  ],
});

export const serviceaccountsConfig = namedCoreResource({
  id: "serviceaccounts",
  path: "/kubernetes/security/serviceaccounts",
  title: "Service Accounts",
  subtitle: "Manage namespace service identities",
  kind: "ServiceAccount",
  namespaced: true,
  detailSections: kubernetesServiceAccountDetailSections,
  buildResource: (values) => ({ apiVersion: "v1", kind: "ServiceAccount", metadata: { name: shared.stringValue(values.name, "example-serviceaccount"), namespace: shared.stringValue(values.namespace, "default") } }),
  extraColumns: [{ label: "Secrets", value: (r) => String(Array.isArray((r as any).secrets) ? (r as any).secrets.length : 0) }],
});

export const rolesConfig = extensionResource({
  groupVersion: "rbac.authorization.k8s.io/v1",
  id: "roles",
  path: "/kubernetes/security/roles",
  title: "Roles",
  subtitle: "Manage namespace RBAC permission rules",
  kind: "Role",
  namespaced: true,
  detailSections: kubernetesRoleDetailSections,
  createFields: [{ name: "apiGroups", label: "API Groups", section: "Rules", defaultValue: "" }, { name: "resources", label: "Resources", section: "Rules", defaultValue: "pods" }, { name: "verbs", label: "Verbs", section: "Rules", defaultValue: "get,list,watch" }],
  buildResource: (values) => ({ apiVersion: "rbac.authorization.k8s.io/v1", kind: "Role", metadata: { name: shared.stringValue(values.name, "example-role"), namespace: shared.stringValue(values.namespace, "default") }, rules: [{ apiGroups: shared.csvList(String(values.apiGroups || "")), resources: shared.csvList(String(values.resources || "pods")), verbs: shared.csvList(String(values.verbs || "get,list,watch")) }] }),
  extraColumns: [{ label: "Rules", value: (r) => String(Array.isArray((r as any).rules) ? (r as any).rules.length : 0) }],
});

export const rolebindingsConfig = extensionResource({
  groupVersion: "rbac.authorization.k8s.io/v1",
  id: "rolebindings",
  path: "/kubernetes/security/rolebindings",
  title: "Role Bindings",
  subtitle: "Bind Roles or ClusterRoles to users, groups, and service accounts",
  kind: "RoleBinding",
  namespaced: true,
  detailSections: kubernetesRoleBindingDetailSections,
  createFields: [{ name: "roleKind", label: "Role Kind", section: "Role", type: "select", defaultValue: "Role", options: [{ label: "Role", value: "Role" }, { label: "ClusterRole", value: "ClusterRole" }] }, { name: "roleName", label: "Role Name", section: "Role", defaultValue: "example-role" }, { name: "subjectKind", label: "Subject Kind", section: "Subject", type: "select", defaultValue: "ServiceAccount", options: [{ label: "ServiceAccount", value: "ServiceAccount" }, { label: "User", value: "User" }, { label: "Group", value: "Group" }] }, { name: "subjectName", label: "Subject Name", section: "Subject", defaultValue: "default" }],
  buildResource: (values) => ({ apiVersion: "rbac.authorization.k8s.io/v1", kind: "RoleBinding", metadata: { name: shared.stringValue(values.name, "example-rolebinding"), namespace: shared.stringValue(values.namespace, "default") }, roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: shared.stringValue(values.roleKind, "Role"), name: shared.stringValue(values.roleName, "example-role") }, subjects: [{ kind: shared.stringValue(values.subjectKind, "ServiceAccount"), name: shared.stringValue(values.subjectName, "default"), namespace: shared.stringValue(values.namespace, "default") }] }),
  extraColumns: [{ label: "Role", value: (r) => `${shared.getRecord((r as any).roleRef).kind || ""}/${shared.getRecord((r as any).roleRef).name || ""}` }],
});

export const clusterrolesConfig = extensionResource({
  groupVersion: "rbac.authorization.k8s.io/v1",
  id: "clusterroles",
  path: "/kubernetes/security/clusterroles",
  title: "Cluster Roles",
  subtitle: "Manage cluster-scoped RBAC permission rules",
  kind: "ClusterRole",
  namespaced: false,
  detailSections: kubernetesRoleDetailSections,
  createFields: [{ name: "apiGroups", label: "API Groups", section: "Rules", defaultValue: "" }, { name: "resources", label: "Resources", section: "Rules", defaultValue: "pods" }, { name: "verbs", label: "Verbs", section: "Rules", defaultValue: "get,list,watch" }],
  buildResource: (values) => ({ apiVersion: "rbac.authorization.k8s.io/v1", kind: "ClusterRole", metadata: { name: shared.stringValue(values.name, "example-clusterrole") }, rules: [{ apiGroups: shared.csvList(String(values.apiGroups || "")), resources: shared.csvList(String(values.resources || "pods")), verbs: shared.csvList(String(values.verbs || "get,list,watch")) }] }),
  extraColumns: [{ label: "Rules", value: (r) => String(Array.isArray((r as any).rules) ? (r as any).rules.length : 0) }],
});

export const clusterrolebindingsConfig = extensionResource({
  groupVersion: "rbac.authorization.k8s.io/v1",
  id: "clusterrolebindings",
  path: "/kubernetes/security/clusterrolebindings",
  title: "Cluster Role Bindings",
  subtitle: "Bind ClusterRoles across the cluster",
  kind: "ClusterRoleBinding",
  namespaced: false,
  detailSections: kubernetesRoleBindingDetailSections,
  createFields: [{ name: "roleName", label: "Cluster Role Name", section: "Role", defaultValue: "view" }, { name: "subjectKind", label: "Subject Kind", section: "Subject", type: "select", defaultValue: "ServiceAccount", options: [{ label: "ServiceAccount", value: "ServiceAccount" }, { label: "User", value: "User" }, { label: "Group", value: "Group" }] }, { name: "subjectName", label: "Subject Name", section: "Subject", defaultValue: "default" }, { name: "subjectNamespace", label: "Subject Namespace", section: "Subject", defaultValue: "default" }],
  buildResource: (values) => ({ apiVersion: "rbac.authorization.k8s.io/v1", kind: "ClusterRoleBinding", metadata: { name: shared.stringValue(values.name, "example-clusterrolebinding") }, roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "ClusterRole", name: shared.stringValue(values.roleName, "view") }, subjects: [{ kind: shared.stringValue(values.subjectKind, "ServiceAccount"), name: shared.stringValue(values.subjectName, "default"), namespace: shared.stringValue(values.subjectNamespace, "default") }] }),
  extraColumns: [{ label: "Role", value: (r) => String(shared.getRecord((r as any).roleRef).name || "N/A") }],
});

export const poddisruptionbudgetsConfig = extensionResource({
  groupVersion: "policy/v1",
  id: "poddisruptionbudgets",
  path: "/kubernetes/policy/pod-disruption-budgets",
  title: "Pod Disruption Budgets",
  subtitle: "Manage voluntary disruption limits for selected pods",
  kind: "PodDisruptionBudget",
  namespaced: true,
  detailSections: kubernetesPodDisruptionBudgetDetailSections,
  createFields: [{ name: "minAvailable", label: "Min Available", section: "Budget", defaultValue: "1" }, { name: "selectorKey", label: "Selector Key", section: "Selector", defaultValue: "app" }, { name: "selectorValue", label: "Selector Value", section: "Selector", defaultValue: "example" }],
  buildResource: (values) => ({ apiVersion: "policy/v1", kind: "PodDisruptionBudget", metadata: { name: shared.stringValue(values.name, "example-pdb"), namespace: shared.stringValue(values.namespace, "default") }, spec: { minAvailable: shared.stringValue(values.minAvailable, "1"), selector: { matchLabels: { [shared.stringValue(values.selectorKey, "app")]: shared.stringValue(values.selectorValue, "example") } } } }),
  extraColumns: [{ label: "Allowed", value: (r) => String(shared.getRecord(r.status).disruptionsAllowed || 0) }, { label: "Healthy", value: (r) => `${shared.getRecord(r.status).currentHealthy || 0} / ${shared.getRecord(r.status).desiredHealthy || 0}` }],
});

export const customresourcedefinitionsConfig = extensionResource({
  groupVersion: "apiextensions.k8s.io/v1",
  id: "customresourcedefinitions",
  path: "/kubernetes/cluster/custom-resource-definitions",
  title: "Custom Resource Definitions",
  subtitle: "Inspect installed CRDs, versions, scope, and accepted names",
  kind: "CustomResourceDefinition",
  namespaced: false,
  allowCreate: false,
  detailSections: kubernetesCustomResourceDefinitionDetailSections,
  extraColumns: [{ label: "Group", value: (r) => String(shared.getRecord(r.spec).group || "N/A") }, { label: "Scope", value: (r) => String(shared.getRecord(r.spec).scope || "N/A") }],
});
