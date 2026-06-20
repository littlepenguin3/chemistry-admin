import { Alert, Button, Flex, Form, Input, Radio, Space, Tag, Typography, type FormInstance } from "antd";
import { CheckCircleOutlined, SaveOutlined } from "@ant-design/icons";

import type { CatalogNodeDetail } from "../../api/catalogTree";
import type { CatalogMutations } from "./catalogTreeHooks";
import {
  buildCatalogNodeUpdatePayload,
  type CatalogNodeFormValues,
  type CatalogPointContentFormValues,
} from "./catalogTreeMappers";

const { Text } = Typography;

export function CatalogNodeContentPanel({
  detail,
  nodeForm,
  pointForm,
  principleMode,
  mutations,
  onSavePointContent,
}: {
  detail: CatalogNodeDetail;
  nodeForm: FormInstance<CatalogNodeFormValues>;
  pointForm: FormInstance<CatalogPointContentFormValues>;
  principleMode?: string;
  mutations: CatalogMutations;
  onSavePointContent: (values: CatalogPointContentFormValues) => Promise<void>;
}) {
  const { node } = detail;

  if (node.node_kind === "directory") {
    return (
      <section className="catalog-editor-section catalog-editor-panel-section">
        <div className="catalog-editor-section-intro">
          <Text strong>基础信息</Text>
          <Text type="secondary">目录负责学生端导航与分类，不承载点位知识或视频绑定。</Text>
        </div>
        <Form
          form={nodeForm}
          layout="vertical"
          onFinish={(values) => mutations.updateNode.mutate({ nodeId: node.node_id, payload: buildCatalogNodeUpdatePayload(values) })}
        >
          <Form.Item name="node_kind" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="目录标题" rules={[{ required: true, message: "请输入目录标题" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="teacher_note"
            label="教学备注"
            extra="仅教师端可见，不进入学生端、学生搜索或题目证据链。"
          >
            <Input.TextArea className="catalog-teacher-note" autoSize={{ minRows: 2, maxRows: 5 }} />
          </Form.Item>
          <Alert type="info" showIcon title="学生可见描述和卡片样式在“学生卡片”面板维护。" />
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={mutations.updateNode.isPending}>
            保存目录内容
          </Button>
        </Form>
      </section>
    );
  }

  return (
    <section className="catalog-editor-section catalog-editor-panel-section">
      <Flex className="catalog-editor-section-heading" align="center" justify="space-between" gap={12}>
        <div className="catalog-editor-section-intro">
          <Text strong>知识字段</Text>
          <Text type="secondary">默认只显示老师最常维护的点位知识字段。</Text>
        </div>
        <Space wrap>
          <Tag color={detail.point_content?.content_status === "published" ? "green" : "gold"}>
            {detail.point_content?.content_status || "missing"}
          </Tag>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={() => mutations.changePointPublication.mutate({ nodeId: node.node_id, action: "publish" })}
            loading={mutations.changePointPublication.isPending}
          >
            发布点位内容
          </Button>
        </Space>
      </Flex>
      <Form form={pointForm} layout="vertical" onFinish={onSavePointContent}>
        <Form.Item name="point_title" label="点位名" rules={[{ required: true, message: "请输入点位名" }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="teacher_note"
          label="教学备注"
          extra="仅教师端可见，不进入学生端、学生搜索或题目证据链。"
        >
          <Input.TextArea className="catalog-teacher-note" autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>
        <Form.Item name="principle_mode" label="实验原理形式" rules={[{ required: true }]}>
          <Radio.Group optionType="button" buttonStyle="solid">
            <Radio.Button value="equation">化学方程式</Radio.Button>
            <Radio.Button value="text">文字描述</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {principleMode === "equation" ? (
          <Form.Item name="principle_equation" label="化学方程式" rules={[{ required: true, message: "请输入化学方程式" }]}>
            <Input />
          </Form.Item>
        ) : (
          <Form.Item name="principle_text" label="文字原理" rules={[{ required: true, message: "请输入文字原理" }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 7 }} />
          </Form.Item>
        )}
        <Form.Item name="phenomenon_explanation" label="现象解释" rules={[{ required: true, message: "请输入现象解释" }]}>
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 7 }} />
        </Form.Item>
        <Form.Item name="safety_note" label="安全提示" rules={[{ required: true, message: "请输入安全提示" }]}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={mutations.savePointContent.isPending || mutations.updateNode.isPending}
        >
          保存点位内容
        </Button>
      </Form>
    </section>
  );
}
