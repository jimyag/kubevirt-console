import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const csidriversConfig: ResourceConfig = {
    id: "csidrivers",
    path: "/storage/kubernetes/csi-drivers",
    title: "CSI Drivers",
    subtitle: "Manage Kubernetes CSIDriver capability declarations",
    listPath: "/apis/storage.k8s.io/v1/csidrivers",
    namespaced: false,
    resourcePath: "/apis/storage.k8s.io/v1",
    kind: "CSIDriver",
    createFields: [
      ...shared.nameOnlyFields("example.csi.io"),
      { name: "attachRequired", label: "Attach Required", section: "Capabilities", type: "checkbox", defaultValue: true },
      { name: "podInfoOnMount", label: "Pod Info On Mount", section: "Capabilities", type: "checkbox", defaultValue: false },
      { name: "storageCapacity", label: "Storage Capacity", section: "Capabilities", type: "checkbox", defaultValue: false },
      { name: "requiresRepublish", label: "Requires Republish", section: "Capabilities", type: "checkbox", defaultValue: false },
      { name: "fsGroupPolicy", label: "FS Group Policy", section: "Policy", type: "select", defaultValue: "ReadWriteOnceWithFSType", options: [{ label: "ReadWriteOnceWithFSType", value: "ReadWriteOnceWithFSType" }, { label: "File", value: "File" }, { label: "None", value: "None" }] },
      { name: "volumeLifecycleModes", label: "Volume Lifecycle Modes", section: "Capabilities", defaultValue: "Persistent", placeholder: "Persistent,Ephemeral" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "storage.k8s.io/v1",
      kind: "CSIDriver",
      metadata: { name: shared.stringValue(values.name, "example.csi.io") },
      spec: {
        attachRequired: values.attachRequired === true,
        podInfoOnMount: values.podInfoOnMount === true,
        storageCapacity: values.storageCapacity === true,
        requiresRepublish: values.requiresRepublish === true,
        fsGroupPolicy: shared.stringValue(values.fsGroupPolicy, "ReadWriteOnceWithFSType"),
        volumeLifecycleModes: shared.csvList(values.volumeLifecycleModes),
      },
    }),
    statusPath: ["spec", "fsGroupPolicy"],
    detailSections: shared.csiDriverDetailSections,
    extraColumns: [
      { label: "Attach", value: (r) => String(shared.getRecord(r.spec).attachRequired ?? "N/A") },
      { label: "Capacity", value: (r) => String(shared.getRecord(r.spec).storageCapacity ?? "N/A") },
      { label: "FS Group", value: (r) => String(shared.getRecord(r.spec).fsGroupPolicy || "N/A") },
    ],
    createTemplate: `apiVersion: storage.k8s.io/v1
kind: CSIDriver
metadata:
  name: example.csi.io
spec:
  attachRequired: true
  podInfoOnMount: false
  storageCapacity: false
  fsGroupPolicy: ReadWriteOnceWithFSType
  volumeLifecycleModes:
    - Persistent
`,
  };
