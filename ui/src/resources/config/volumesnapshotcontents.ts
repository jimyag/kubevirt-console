import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const volumesnapshotcontentsConfig: ResourceConfig = {
    id: "volumesnapshotcontents",
    path: "/storage/kubernetes/volume-snapshot-contents",
    title: "Volume Snapshot Contents",
    subtitle: "Manage CSI VolumeSnapshotContent backing objects",
    listPath: "/apis/snapshot.storage.k8s.io/v1/volumesnapshotcontents",
    namespaced: false,
    resourcePath: "/apis/snapshot.storage.k8s.io/v1",
    kind: "VolumeSnapshotContent",
    createFields: [
      ...shared.nameOnlyFields("example-snapshot-content"),
      { name: "snapshotName", label: "Snapshot Name", section: "Snapshot Ref", defaultValue: "example-snapshot" },
      { name: "snapshotNamespace", label: "Snapshot Namespace", section: "Snapshot Ref", defaultValue: "default" },
      { name: "snapshotClassName", label: "Snapshot Class", section: "Snapshot", defaultValue: "example-snapshot-class" },
      { name: "driver", label: "Driver", section: "Driver", defaultValue: "example.csi.io" },
      { name: "deletionPolicy", label: "Deletion Policy", section: "Policy", type: "select", defaultValue: "Delete", options: [{ label: "Delete", value: "Delete" }, { label: "Retain", value: "Retain" }] },
      { name: "snapshotHandle", label: "Snapshot Handle", section: "Source", defaultValue: "snapshot-handle" },
    ],
    buildCreateResource: (values) => ({
      apiVersion: "snapshot.storage.k8s.io/v1",
      kind: "VolumeSnapshotContent",
      metadata: { name: shared.stringValue(values.name, "example-snapshot-content") },
      spec: {
        volumeSnapshotClassName: shared.stringValue(values.snapshotClassName, "example-snapshot-class"),
        driver: shared.stringValue(values.driver, "example.csi.io"),
        deletionPolicy: shared.stringValue(values.deletionPolicy, "Delete"),
        source: { snapshotHandle: shared.stringValue(values.snapshotHandle, "snapshot-handle") },
        volumeSnapshotRef: {
          name: shared.stringValue(values.snapshotName, "example-snapshot"),
          namespace: shared.stringValue(values.snapshotNamespace, "default"),
        },
      },
    }),
    statusPath: ["status", "readyToUse"],
    detailSections: shared.volumeSnapshotContentDetailSections,
    extraColumns: [
      { label: "Ready", value: (r) => String(shared.getRecord(r.status).readyToUse ?? "N/A") },
      { label: "Driver", value: (r) => String(shared.getRecord(r.spec).driver || "N/A") },
      { label: "Class", value: (r) => String(shared.getRecord(r.spec).volumeSnapshotClassName || "N/A") },
    ],
    createTemplate: `apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotContent
metadata:
  name: example-snapshot-content
spec:
  deletionPolicy: Delete
  driver: example.csi.io
  source:
    snapshotHandle: snapshot-handle
  volumeSnapshotClassName: example-snapshot-class
  volumeSnapshotRef:
    name: example-snapshot
    namespace: default
`,
  };
