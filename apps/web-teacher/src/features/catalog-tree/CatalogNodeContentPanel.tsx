import { useState } from "react";
import { Alert, Button, Flex, Form, Input, Radio, Space, Tag, Typography, type FormInstance } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";

import { previewCatalogReactionEquations, type CatalogEquationPreviewResponse, type CatalogNodeDetail } from "../../api/catalogTree";
import { AssistantMarkdownContent } from "../../lib/assistant-markdown";
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
  const [equationPreview, setEquationPreview] = useState<CatalogEquationPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const equationRows = () => pointForm.getFieldValue("reaction_equations") || [];
  const appendEquationSnippet = (snippet: string) => {
    const rows = equationRows();
    if (!rows.length) {
      pointForm.setFieldValue("reaction_equations", [{ raw_text: snippet, row_order: 1 }]);
      return;
    }
    const lastIndex = rows.length - 1;
    const current = String(rows[lastIndex]?.raw_text || "");
    pointForm.setFieldValue(["reaction_equations", lastIndex, "raw_text"], `${current}${snippet}`);
  };
  const previewEquations = async () => {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const rows = equationRows().map((row: { raw_text?: string }, index: number) => ({
        raw_text: String(row?.raw_text || "").trim(),
        row_order: index + 1,
      }));
      setEquationPreview(await previewCatalogReactionEquations(rows));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "后端预览失败");
    } finally {
      setPreviewLoading(false);
    }
  };

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
          <div className="catalog-equation-editor">
            <div className="catalog-equation-toolbar">
              <Text strong>化学方程式</Text>
              <Space wrap>
                {[" + ", " = ", " → ", " ⇌ ", "(aq)", "(s)", "(g)", "↑", "↓", "H+", "OH-", "H2O"].map((snippet) => (
                  <Button key={snippet} size="small" onClick={() => appendEquationSnippet(snippet)}>
                    {snippet}
                  </Button>
                ))}
                <Button icon={<EyeOutlined />} loading={previewLoading} onClick={previewEquations}>
                  后端预览
                </Button>
              </Space>
            </div>
            <Form.List name="reaction_equations">
              {(fields, { add, remove, move }) => (
                <div className="catalog-equation-list">
                  {fields.map((field, index) => (
                    <div className="catalog-equation-row" key={field.key}>
                      <Form.Item
                        {...field}
                        name={[field.name, "raw_text"]}
                        rules={[{ required: true, message: "请输入化学方程式，或删除该行" }]}
                      >
                        <Input placeholder="例如：Cl2 + 2 KBr = 2 KCl + Br2" />
                      </Form.Item>
                      <Space.Compact>
                        <Button aria-label="上移方程式" title="上移" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, index - 1)} />
                        <Button
                          aria-label="下移方程式"
                          title="下移"
                          icon={<ArrowDownOutlined />}
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                        />
                        <Button danger aria-label="删除方程式" title="删除" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      </Space.Compact>
                    </div>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => add({ raw_text: "", row_order: fields.length + 1 })}>
                    添加方程式
                  </Button>
                </div>
              )}
            </Form.List>
            {previewError ? <Alert type="error" showIcon message={previewError} /> : null}
            {equationPreview ? (
              <div className="catalog-equation-preview">
                {equationPreview.equations.length ? (
                  equationPreview.equations.map((equation) => (
                    <Alert
                      key={`${equation.row_order}-${equation.raw_text}`}
                      type={equation.validation_status === "invalid" ? "error" : equation.validation_status === "warning" ? "warning" : "success"}
                      showIcon
                      message={
                        equation.canonical_mhchem ? (
                          <AssistantMarkdownContent text={`$${equation.canonical_mhchem}$`} inline />
                        ) : (
                          equation.raw_text
                        )
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">后端状态：{equation.validation_status}</Text>
                          {equation.formulae.length ? <Text type="secondary">公式：{equation.formulae.join(", ")}</Text> : null}
                          {[...equation.warnings, ...equation.errors].map((item) => (
                            <Text key={item} type={equation.errors.includes(item) ? "danger" : "secondary"}>
                              {item}
                            </Text>
                          ))}
                        </Space>
                      }
                    />
                  ))
                ) : (
                  <Alert type="info" showIcon message="暂无可预览方程式" />
                )}
              </div>
            ) : null}
          </div>
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
