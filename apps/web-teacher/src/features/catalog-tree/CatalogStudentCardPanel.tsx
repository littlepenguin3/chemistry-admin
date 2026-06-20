import { Button, Form, Input, Radio, Select, Typography, type FormInstance } from "antd";
import { SaveOutlined } from "@ant-design/icons";

import type { CatalogNodeDetail } from "../../api/catalogTree";
import type { CatalogMutations } from "./catalogTreeHooks";
import { buildCatalogNodeUpdatePayload, displayCatalogPointTitle, type CatalogNodeFormValues } from "./catalogTreeMappers";

const { Text, Title } = Typography;

export function CatalogStudentCardPanel({
  detail,
  nodeForm,
  mutations,
}: {
  detail: CatalogNodeDetail;
  nodeForm: FormInstance<CatalogNodeFormValues>;
  mutations: CatalogMutations;
}) {
  const { node } = detail;
  const isDirectory = node.node_kind === "directory";

  return (
    <section className="catalog-editor-section catalog-editor-panel-section">
      <div>
        <Title level={4}>{isDirectory ? "目录学生卡片" : "点位卡片显示"}</Title>
        <Text type="secondary">
          {isDirectory
            ? "目录卡片承担学生端分类入口，可以维护图片、标题、描述和视觉强调。"
            : "点位卡片只允许有限覆盖，避免和目录卡片混淆。未设置时使用点位名和视频缩略图。"}
        </Text>
      </div>
      <Form
        form={nodeForm}
        layout="vertical"
        onFinish={(values) => mutations.updateNode.mutate({ nodeId: node.node_id, payload: buildCatalogNodeUpdatePayload(values) })}
      >
        <Form.Item name="node_kind" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="title" hidden>
          <Input />
        </Form.Item>
        {isDirectory ? (
          <>
            <Form.Item name="student_description" label="学生端卡片描述">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
            </Form.Item>
            <div className="catalog-form-grid">
              <Form.Item name="card_image_asset_id" label="卡片图片素材 ID">
                <Input placeholder="可留空" />
              </Form.Item>
              <Form.Item name="card_icon_key" label="图标键">
                <Input placeholder="flask / lightning / shield" />
              </Form.Item>
              <Form.Item name="card_accent" label="强调色">
                <Input placeholder="blue / green / violet" />
              </Form.Item>
              <Form.Item name="card_layout" label="卡片样式">
                <Select
                  options={[
                    { value: "default", label: "默认" },
                    { value: "compact", label: "紧凑" },
                    { value: "image", label: "图片" },
                    { value: "hero", label: "重点" },
                  ]}
                />
              </Form.Item>
            </div>
            <div className="catalog-card-preview kind-directory">
              <Text className="eyebrow">学生端预览</Text>
              <strong>{node.title}</strong>
              <span>{node.student_description || "暂无学生端描述"}</span>
            </div>
          </>
        ) : (
          <>
            <Form.Item name="point_card_short_description" label="点位卡片短描述">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} />
            </Form.Item>
            <div className="catalog-form-grid">
              <Form.Item name="point_card_cover_image_asset_id" label="点位封面素材 ID">
                <Input placeholder="默认使用视频缩略图" />
              </Form.Item>
              <Form.Item name="point_card_icon_key" label="点位图标键">
                <Input placeholder="play / flask / reaction" />
              </Form.Item>
              <Form.Item name="point_card_accent" label="点位强调色">
                <Input placeholder="blue / green / violet" />
              </Form.Item>
              <Form.Item name="point_card_emphasis" label="重点卡片">
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value={false}>普通</Radio.Button>
                  <Radio.Button value={true}>重点</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </div>
            <div className="catalog-card-preview kind-point">
              <Text className="eyebrow">默认点位卡片</Text>
              <strong>{displayCatalogPointTitle(detail)}</strong>
              <span>默认显示点位名和已绑定视频缩略图。</span>
            </div>
          </>
        )}
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={mutations.updateNode.isPending}>
          保存学生卡片
        </Button>
      </Form>
    </section>
  );
}
