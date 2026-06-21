import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AndroidMockup, IPhoneMockup } from "react-device-mockup";
import { Button, Empty, Select, Space, Typography } from "antd";
import { ExportOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";

import "./catalogTree.css";

const { Text, Title } = Typography;

type DevicePreset =
  | {
      key: "iphone17Pro" | "iphone17" | "iphone17ProMax" | "iphone15" | "iphone14" | "iphoneSE";
      label: string;
      family: "iphone";
      screenWidth: number;
      viewportHeight: number;
      screenType: "legacy" | "notch" | "island";
    }
  | {
      key:
        | "huaweiMate80Pro"
        | "huaweiPura80Pro"
        | "xiaomi17"
        | "xiaomi17Ultra"
        | "oppoFindX8Pro"
        | "vivoX200Pro"
        | "android";
      label: string;
      family: "android";
      screenWidth: number;
      viewportHeight: number;
      camera: "center-hole" | "left-hole" | "pill" | "wide-pill" | "fold-inner";
      cameraLabel: string;
    };

const devicePresets: DevicePreset[] = [
  { key: "iphone17Pro", label: "iPhone 17 Pro", family: "iphone", screenWidth: 402, viewportHeight: 874, screenType: "island" },
  { key: "iphone17", label: "iPhone 17", family: "iphone", screenWidth: 402, viewportHeight: 874, screenType: "island" },
  {
    key: "iphone17ProMax",
    label: "iPhone 17 Pro Max",
    family: "iphone",
    screenWidth: 440,
    viewportHeight: 956,
    screenType: "island",
  },
  { key: "iphone15", label: "iPhone 15 Pro", family: "iphone", screenWidth: 393, viewportHeight: 852, screenType: "island" },
  { key: "iphone14", label: "iPhone 14", family: "iphone", screenWidth: 390, viewportHeight: 844, screenType: "notch" },
  { key: "iphoneSE", label: "iPhone SE", family: "iphone", screenWidth: 375, viewportHeight: 667, screenType: "legacy" },
  {
    key: "huaweiMate80Pro",
    label: "HUAWEI Mate 80 Pro",
    family: "android",
    screenWidth: 427,
    viewportHeight: 945,
    camera: "pill",
    cameraLabel: "pill camera",
  },
  {
    key: "huaweiPura80Pro",
    label: "HUAWEI Pura 80 Pro",
    family: "android",
    screenWidth: 425,
    viewportHeight: 949,
    camera: "wide-pill",
    cameraLabel: "wide pill camera",
  },
  {
    key: "xiaomi17",
    label: "Xiaomi 17",
    family: "android",
    screenWidth: 407,
    viewportHeight: 885,
    camera: "center-hole",
    cameraLabel: "center punch-hole",
  },
  {
    key: "xiaomi17Ultra",
    label: "Xiaomi 17 Ultra",
    family: "android",
    screenWidth: 400,
    viewportHeight: 869,
    camera: "center-hole",
    cameraLabel: "center punch-hole",
  },
  {
    key: "oppoFindX8Pro",
    label: "OPPO Find X8 Pro",
    family: "android",
    screenWidth: 421,
    viewportHeight: 927,
    camera: "left-hole",
    cameraLabel: "left punch-hole",
  },
  {
    key: "vivoX200Pro",
    label: "vivo X200 Pro",
    family: "android",
    screenWidth: 420,
    viewportHeight: 933,
    camera: "center-hole",
    cameraLabel: "center punch-hole",
  },
  {
    key: "android",
    label: "Android Generic",
    family: "android",
    screenWidth: 412,
    viewportHeight: 892,
    camera: "fold-inner",
    cameraLabel: "inner-screen camera",
  },
];

function inferStudentAppBase(): string {
  const configured = String(import.meta.env.VITE_STUDENT_APP_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }
  return window.location.origin;
}

function resolveStudentPreviewUrl(previewUrl: string): string {
  if (!previewUrl) return "";
  try {
    return new URL(previewUrl).toString();
  } catch {
    return new URL(previewUrl, inferStudentAppBase()).toString();
  }
}

function openPagePreview(url: string, preset: DevicePreset) {
  const width = Math.min(Math.max(preset.screenWidth + 28, 390), 540);
  const height = Math.min(Math.max(preset.viewportHeight + 112, 720), 1080);
  const popup = window.open(url, "_blank", `popup,width=${width},height=${height}`);
  if (!popup) return;
  popup.opener = null;
  popup.focus();
}

function formatExpiry(value: string): string {
  if (!value) return "本次预览链接短时有效";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return `有效至 ${new Date(timestamp).toLocaleString()}`;
}

function DeviceFrame({ preset, children }: { preset: DevicePreset; children: ReactNode }) {
  if (preset.family === "android") {
    return (
      <div className="catalog-preview-android-shell">
        <AndroidMockup
          screenWidth={preset.screenWidth}
          frameColor="#1f2933"
          statusbarColor="#f7faf9"
          navBarColor="#f7faf9"
          className="catalog-preview-device"
        >
          {children}
        </AndroidMockup>
        <span className="catalog-preview-camera-note">{preset.cameraLabel}</span>
      </div>
    );
  }
  return (
    <IPhoneMockup
      screenWidth={preset.screenWidth}
      screenType={preset.screenType}
      frameColor="#1f2933"
      statusbarColor="#f7faf9"
      className="catalog-preview-device"
    >
      {children}
    </IPhoneMockup>
  );
}

export function CatalogPointPreviewWindow() {
  const [searchParams] = useSearchParams();
  const [deviceKey, setDeviceKey] = useState<DevicePreset["key"]>("iphone17Pro");
  const previewUrl = searchParams.get("previewUrl") || "";
  const title = searchParams.get("title") || "学习卡片预览";
  const expiresAt = searchParams.get("expiresAt") || "";
  const iframeSrc = useMemo(() => resolveStudentPreviewUrl(previewUrl), [previewUrl]);
  const preset = devicePresets.find((item) => item.key === deviceKey) || devicePresets[0];

  if (!iframeSrc) {
    return (
      <div className="catalog-preview-window">
        <Empty description="缺少预览链接，请从点位工作台重新打开预览。" />
      </div>
    );
  }

  return (
    <div className="catalog-preview-window">
      <header className="catalog-preview-toolbar">
        <div>
          <Title level={4}>{title}</Title>
          <Text type="secondary">{formatExpiry(expiresAt)}</Text>
        </div>
        <Space wrap>
          <Select
            aria-label="选择预览设备"
            className="catalog-preview-device-select"
            value={deviceKey}
            options={devicePresets.map((item) => ({ value: item.key, label: item.label }))}
            onChange={(value) => setDeviceKey(value as DevicePreset["key"])}
          />
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新
          </Button>
          <Button
            className="catalog-preview-page-button"
            icon={<ExportOutlined />}
            onClick={() => openPagePreview(iframeSrc, preset)}
          >
            页面预览
          </Button>
        </Space>
      </header>
      <main className="catalog-preview-stage">
        <DeviceFrame preset={preset}>
          <iframe className="catalog-preview-iframe" title={`预览 ${title}`} src={iframeSrc} />
        </DeviceFrame>
      </main>
    </div>
  );
}
