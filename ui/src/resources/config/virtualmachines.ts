import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const vmCreateConfig: ResourceConfig = {
  id: "virtualmachines",
  path: "/kubevirt/virtualization/virtual-machines",
  title: "Virtual Machines",
  subtitle: "Create a KubeVirt virtual machine",
  listPath: "/apis/kubevirt.io/v1/virtualmachines",
  namespaced: true,
  resourcePath: "/apis/kubevirt.io/v1",
  kind: "VirtualMachine",
  createTemplate: "",
  createFields: [
    ...shared.namespaceNameFields("example-vm"),
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
    const name = shared.stringValue(values.name, "example-vm");
    const labels = { ...shared.parseKeyValueText(shared.stringValue(values.labels)), "kubevirt.io/domain": name };
    const annotations = shared.parseKeyValueText(shared.stringValue(values.annotations));
    const networkMode = shared.stringValue(values.networkMode, "masquerade");
    const priorityClassName = shared.stringValue(values.priorityClassName);
    const instanceType = shared.stringValue(values.instanceType);
    return {
      apiVersion: "kubevirt.io/v1",
      kind: "VirtualMachine",
      metadata: {
        name,
        namespace: shared.stringValue(values.namespace, "default"),
        labels,
        ...(Object.keys(annotations).length ? { annotations } : {}),
      },
      spec: {
        runStrategy: shared.stringValue(values.runStrategy, "Halted"),
        ...(instanceType ? { instancetype: { name: instanceType } } : {}),
        template: {
          metadata: { labels, ...(Object.keys(annotations).length ? { annotations } : {}) },
          spec: {
            ...(priorityClassName ? { priorityClassName } : {}),
            domain: {
              machine: { type: shared.stringValue(values.machineType, "q35") },
              cpu: {
                sockets: shared.numberValue(values.sockets, 1),
                cores: shared.numberValue(values.cpu, 1),
                threads: shared.numberValue(values.threads, 1),
              },
              resources: { requests: { memory: shared.stringValue(values.memory, "1Gi") } },
              devices: {
                disks: [
                  { name: "containerdisk", disk: { bus: shared.stringValue(values.diskBus, "virtio") } },
                  { name: "cloudinitdisk", disk: { bus: shared.stringValue(values.diskBus, "virtio") } },
                ],
                interfaces: [{ name: "default", [networkMode]: {} }],
              },
            },
            networks: [{ name: "default", pod: {} }],
            volumes: [
              { name: "containerdisk", containerDisk: { image: shared.stringValue(values.containerImage, "quay.io/containerdisks/fedora:latest") } },
              { name: "cloudinitdisk", cloudInitNoCloud: { userData: shared.stringValue(values.cloudInit) } },
            ],
          },
        },
      },
    };
  },
};
