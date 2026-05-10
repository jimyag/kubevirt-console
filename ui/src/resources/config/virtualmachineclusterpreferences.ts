import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const virtualmachineclusterpreferencesConfig: ResourceConfig = shared.instancetypeResourceConfig({
    plural: "virtualmachineclusterpreferences",
    path: "/kubevirt/templates/cluster-preferences",
    title: "Cluster Preferences",
    subtitle: "Manage KubeVirt VirtualMachineClusterPreference resources",
    kind: "VirtualMachineClusterPreference",
    createFields: [...shared.nameOnlyFields("example-preference"), { name: "machineType", label: "Machine Type", section: "Machine", defaultValue: "q35" }, { name: "cpuTopology", label: "Preferred CPU Topology", section: "CPU", type: "select", defaultValue: "preferSockets", options: [{ label: "Prefer Sockets", value: "preferSockets" }, { label: "Prefer Cores", value: "preferCores" }, { label: "Prefer Threads", value: "preferThreads" }] }],
    buildSpec: (values) => ({ machine: { preferredMachineType: shared.stringValue(values.machineType, "q35") }, cpu: { preferredCPUTopology: shared.stringValue(values.cpuTopology, "preferSockets") } }),
    statusPath: ["metadata", "name"],
  });
