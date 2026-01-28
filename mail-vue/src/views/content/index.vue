<template>
  <div class="box">
    <div class="header-actions">
      <Icon
        class="icon"
        icon="material-symbols-light:arrow-back-ios-new"
        width="20"
        height="20"
        @click="handleBack"
      />
      <Icon
        v-perm="'email:delete'"
        class="icon"
        icon="uiw:delete"
        width="16"
        height="16"
        @click="handleDelete"
      />
      <span class="star" v-if="emailStore.contentData.showStar">
        <Icon
          class="icon"
          @click="changeStar"
          v-if="email.isStar"
          icon="fluent-color:star-16"
          width="20"
          height="20"
        />
        <Icon
          class="icon"
          @click="changeStar"
          v-else
          icon="solar:star-line-duotone"
          width="18"
          height="18"
        />
      </span>
      <Icon
        class="icon"
        v-if="emailStore.contentData.showReply"
        v-perm="'email:send'"
        @click="openReply"
        icon="la:reply"
        width="20"
        height="20"
      />
    </div>

    <el-scrollbar class="scrollbar">
      <div class="container">
        <div class="email-title">{{ email.subject }}</div>

        <div class="content">
          <div class="email-info">
            <div>
              <div class="send">
                <span class="send-source">{{ $t("from") }}</span>
                <div class="send-name">
                  <span class="send-name-title">{{ email.name }}</span>
                  <span>&lt;{{ email.sendEmail }}&gt;</span>
                </div>
              </div>

              <div class="receive">
                <span class="source">{{ $t("recipient") }}</span>
                <span class="receive-email">{{ formateReceive(email.recipient) }}</span>
              </div>

              <div class="date">
                <div>{{ formatDetailDate(email.createTime) }}</div>
              </div>
            </div>

            <el-alert
              v-if="email.status === 3"
              :closable="false"
              :title="`${$t('bounced')} ` + toMessage(email.message)"
              class="email-msg"
              type="error"
              show-icon
            />
            <el-alert
              v-if="email.status === 4"
              :closable="false"
              :title="$t('complained')"
              class="email-msg"
              type="warning"
              show-icon
            />
            <el-alert
              v-if="email.status === 5"
              :closable="false"
              :title="$t('delayed')"
              class="email-msg"
              type="warning"
              show-icon
            />
          </div>

          <!-- ✅ 外链提示（只要检测到外链且未允许就显示） -->
          <el-alert
            v-if="externalState.hasExternal && !allowExternal"
            :closable="false"
            class="external-alert"
            type="warning"
            :title="$t('externalContentBlocked')"
          >
            <template #description>
              <div class="external-alert-actions">
                <span>{{ $t("externalContentDesc") }}</span>
                <el-button size="small" type="primary" @click="allowExternal = true">
                  {{ $t("loadExternalContent") }}
                </el-button>

                <!-- 可选调试：需要时打开 SHOW_EXTERNAL_DEBUG -->
                <span v-if="SHOW_EXTERNAL_DEBUG" class="debug-state">
                  (debug: hasExternal={{ externalState.hasExternal }}, allow={{ allowExternal }})
                </span>
              </div>
            </template>
          </el-alert>

          <el-scrollbar
            class="htm-scrollbar"
            :class="email.attList.length === 0 ? 'bottom-distance' : ''"
          >
            <!-- ✅ 只渲染一次：默认 safeHtml，允许后 fullHtml -->
            <ShadowHtml v-if="email.content" class="shadow-html" :html="renderHtml" />
            <pre v-else class="email-text">{{ email.text }}</pre>
          </el-scrollbar>

          <div class="att" v-if="email.attList.length > 0">
            <div class="att-title">
              <span>{{ $t("attachments") }}</span>
              <span>{{ $t("attCount", { total: email.attList.length }) }}</span>
            </div>

            <div class="att-box">
              <div class="att-item" v-for="att in email.attList" :key="att.attId">
                <div class="att-icon" @click="showImage(att.key)">
                  <Icon v-bind="getIconByName(att.filename)" />
                </div>

                <div class="att-name" @click="showImage(att.key)">
                  {{ att.filename }}
                </div>

                <div class="att-size">{{ formatBytes(att.size) }}</div>

                <div class="opt-icon att-icon">
                  <Icon
                    v-if="isImage(att.filename)"
                    icon="hugeicons:view"
                    width="22"
                    height="22"
                    @click="showImage(att.key)"
                  />
                  <a :href="cvtR2Url(att.key)" download>
                    <Icon icon="system-uicons:push-down" width="22" height="22" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div><!-- /content -->
      </div>
    </el-scrollbar>

    <el-image-viewer
      v-if="showPreview"
      :url-list="srcList"
      show-progress
      @close="showPreview = false"
    />
  </div>
</template>

<script setup>
import ShadowHtml from "@/components/shadow-html/index.vue";
import { computed, reactive, ref, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";

import { emailDelete, emailRead } from "@/request/email.js";
import { starAdd, starCancel } from "@/request/star.js";
import { allEmailDelete } from "@/request/all-email.js";

import { useEmailStore } from "@/store/email.js";
import { useAccountStore } from "@/store/account.js";
import { useSettingStore } from "@/store/setting.js";
import { useUiStore } from "@/store/ui.js";

import { formatDetailDate } from "@/utils/day.js";
import { getExtName, formatBytes } from "@/utils/file-utils.js";
import { cvtR2Url, toOssDomain } from "@/utils/convert.js";
import { getIconByName } from "@/utils/icon-utils.js";
import { EmailUnreadEnum } from "@/enums/email-enum.js";

/**
 * ✅ 调试开关：需要排查按钮为何不出现时设为 true
 */
const SHOW_EXTERNAL_DEBUG = false;

const uiStore = useUiStore();
const settingStore = useSettingStore();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const router = useRouter();
const { t } = useI18n();

const email = emailStore.contentData.email;

const showPreview = ref(false);
const srcList = reactive([]);

const allowExternal = ref(false);

// ✅ 缓存 HTML 与外链检测结果
const externalState = reactive({
  safeHtml: "",
  fullHtml: "",
  hasExternal: false, // 只用于按钮显示条件
});

const renderHtml = computed(() => {
  return allowExternal.value ? externalState.fullHtml : externalState.safeHtml;
});

watch(
  () => accountStore.currentAccountId,
  () => {
    handleBack();
  }
);

watch(
  () => email.emailId,
  () => {
    allowExternal.value = false;
    rebuildHtml();
  },
  { immediate: true }
);

// r2Domain 变化也会影响 {{domain}} 替换
watch(
  () => settingStore.settings.r2Domain,
  () => {
    rebuildHtml();
  }
);

onMounted(() => {
  // ✅ 保险：首次进入强制构建
  rebuildHtml();

  if (emailStore.contentData.showUnread && email.unread === EmailUnreadEnum.UNREAD) {
    email.unread = EmailUnreadEnum.READ;
    emailRead([email.emailId]);
  }
});

onUnmounted(() => {
  emailStore.contentData.showUnread = false;
});

function openReply() {
  uiStore.writerRef.openReply(email);
}

function toMessage(message) {
  return message ? JSON.parse(message).message : "";
}

function formatImage(content) {
  content = content || "";
  const domain = settingStore.settings.r2Domain;
  return content.replace(/{{domain}}/g, toOssDomain(domain) + "/");
}

/**
 * ✅ 核心：构建 safeHtml（剥离外链）和 fullHtml（允许外链）
 */
function rebuildHtml() {
  const formatted = formatImage(email.content || "");
  if (!formatted) {
    externalState.safeHtml = "";
    externalState.fullHtml = "";
    externalState.hasExternal = false;
    return;
  }

  const sanitizedFull = sanitizeEmailHtml(formatted);

  // ✅ 先可靠检测外链，用于按钮显示
  externalState.hasExternal = detectHasExternal(sanitizedFull);

  // ✅ safeHtml：剥离外链
  const blocked = stripExternalResources(sanitizedFull);
  externalState.safeHtml = blocked.html;

  // ✅ fullHtml：允许外链（但仍做净化）
  externalState.fullHtml = sanitizedFull;
}

/**
 * 外链判断
 */
function isExternalUrl(url) {
  if (!url) return false;
  const trimmed = url.trim();

  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("cid:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("#")
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);

    const allowedOrigins = new Set([window.location.origin]);

    const ossDomain = toOssDomain(settingStore.settings.r2Domain);
    if (ossDomain) allowedOrigins.add(new URL(ossDomain).origin);

    return !allowedOrigins.has(parsed.origin);
  } catch {
    // URL 不合法就不当外链，避免误杀
    return false;
  }
}

function srcsetHasExternal(srcset) {
  if (!srcset) return false;
  return srcset
    .split(",")
    .map((entry) => entry.trim().split(" ")[0])
    .some((u) => isExternalUrl(u));
}

/**
 * ✅ 更可靠的外链检测：只用于判断按钮是否显示
 */
function detectHasExternal(content) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // [src], [srcset]
    const srcEls = [...doc.querySelectorAll("[src]")];
    for (const el of srcEls) {
      const src = el.getAttribute("src");
      if (isExternalUrl(src)) return true;

      const srcset = el.getAttribute("srcset");
      if (srcset && srcsetHasExternal(srcset)) return true;
    }

    // link[href]
    const linkEls = [...doc.querySelectorAll("link[href]")];
    for (const el of linkEls) {
      const href = el.getAttribute("href");
      if (isExternalUrl(href)) return true;
    }

    // [background]
    const bgEls = [...doc.querySelectorAll("[background]")];
    for (const el of bgEls) {
      const bg = el.getAttribute("background");
      if (isExternalUrl(bg)) return true;
    }

    // style 属性 url(...)
    const styleAttrEls = [...doc.querySelectorAll("[style]")];
    for (const el of styleAttrEls) {
      const style = el.getAttribute("style") || "";
      const hits = style.match(/url\(([^)]+)\)/gi) || [];
      for (const m of hits) {
        const raw = m.replace(/^url\(|\)$/gi, "").trim().replace(/^['"]|['"]$/g, "");
        if (isExternalUrl(raw)) return true;
      }
    }

    // style 标签 url(...)
    const styleTags = [...doc.querySelectorAll("style")];
    for (const el of styleTags) {
      const css = el.textContent || "";
      const hits = css.match(/url\(([^)]+)\)/gi) || [];
      for (const m of hits) {
        const raw = m.replace(/^url\(|\)$/gi, "").trim().replace(/^['"]|['"]$/g, "");
        if (isExternalUrl(raw)) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * ✅ 剥离外链资源
 */
function stripExternalResources(content) {
  let hasBlocked = false;
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  // src / srcset
  doc.querySelectorAll("[src]").forEach((el) => {
    const src = el.getAttribute("src");
    if (isExternalUrl(src)) {
      hasBlocked = true;
      el.setAttribute("data-blocked-src", src);
      el.removeAttribute("src");
    }
    const srcset = el.getAttribute("srcset");
    if (srcset && srcsetHasExternal(srcset)) {
      hasBlocked = true;
      el.setAttribute("data-blocked-srcset", srcset);
      el.removeAttribute("srcset");
    }
  });

  // link[href]
  doc.querySelectorAll("link[href]").forEach((el) => {
    const href = el.getAttribute("href");
    if (isExternalUrl(href)) {
      hasBlocked = true;
      el.setAttribute("data-blocked-href", href);
      el.removeAttribute("href");
    }
  });

  // background 属性
  doc.querySelectorAll("[background]").forEach((el) => {
    const bg = el.getAttribute("background");
    if (isExternalUrl(bg)) {
      hasBlocked = true;
      el.setAttribute("data-blocked-background", bg);
      el.removeAttribute("background");
    }
  });

  // style="...url(...)..."
  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    if (!style) return;

    const blockedStyle = style.replace(/url\(([^)]+)\)/gi, (match, rawUrl) => {
      const cleaned = rawUrl.trim().replace(/^['"]|['"]$/g, "");
      if (isExternalUrl(cleaned)) {
        hasBlocked = true;
        return "none";
      }
      return match;
    });

    if (blockedStyle !== style) {
      el.setAttribute("data-blocked-style", style);
      el.setAttribute("style", blockedStyle);
    }
  });

  // <style>...url(...)...</style>
  doc.querySelectorAll("style").forEach((el) => {
    const cssText = el.textContent || "";
    if (!cssText) return;

    const blockedCss = cssText.replace(/url\(([^)]+)\)/gi, (match, rawUrl) => {
      const cleaned = rawUrl.trim().replace(/^['"]|['"]$/g, "");
      if (isExternalUrl(cleaned)) {
        hasBlocked = true;
        return "none";
      }
      return match;
    });

    if (blockedCss !== cssText) {
      el.setAttribute("data-blocked-css", cssText);
      el.textContent = blockedCss;
    }
  });

  return { html: doc.body.innerHTML || "", hasBlocked };
}

/**
 * ✅ 邮件 HTML 净化
 */
function sanitizeEmailHtml(content) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  doc.querySelectorAll("script, iframe, object, embed").forEach((el) => el.remove());

  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    });
  });

  return doc.body.innerHTML || "";
}

/**
 * 附件预览
 */
function showImage(key) {
  if (!isImage(key)) return;
  const url = cvtR2Url(key);
  srcList.length = 0;
  srcList.push(url);
  showPreview.value = true;
}

function isImage(filename) {
  return ["png", "jpg", "jpeg", "bmp", "gif", "jfif"].includes(getExtName(filename));
}

function formateReceive(recipient) {
  try {
    const arr = JSON.parse(recipient || "[]");
    return arr.map((item) => item.address).join(", ");
  } catch {
    return "";
  }
}

/**
 * 星标
 */
function changeStar() {
  if (email.isStar) {
    email.isStar = 0;
    starCancel(email.emailId)
      .then(() => {
        email.isStar = 0;
        emailStore.cancelStarEmailId = email.emailId;
        setTimeout(() => (emailStore.cancelStarEmailId = 0));
        emailStore.starScroll?.deleteEmail([email.emailId]);
      })
      .catch((e) => {
        console.error(e);
        email.isStar = 1;
      });
  } else {
    email.isStar = 1;
    starAdd(email.emailId)
      .then(() => {
        email.isStar = 1;
        emailStore.addStarEmailId = email.emailId;
        setTimeout(() => (emailStore.addStarEmailId = 0));
        emailStore.starScroll?.addItem(email);
      })
      .catch((e) => {
        console.error(e);
        email.isStar = 0;
      });
  }
}

const handleBack = () => {
  router.back();
};

const handleDelete = () => {
  ElMessageBox.confirm(t("delEmailConfirm"), {
    confirmButtonText: t("confirm"),
    cancelButtonText: t("cancel"),
    type: "warning",
  }).then(() => {
    if (emailStore.contentData.delType === "logic") {
      emailDelete(email.emailId).then(() => {
        ElMessage({ message: t("delSuccessMsg"), type: "success", plain: true });
        emailStore.deleteIds = [email.emailId];
      });
    } else {
      allEmailDelete(email.emailId).then(() => {
        ElMessage({ message: t("delSuccessMsg"), type: "success", plain: true });
        emailStore.deleteIds = [email.emailId];
      });
    }
    router.back();
  });
};
</script>

<style scoped lang="scss">
.box {
  height: 100%;
  overflow: hidden;
}

.header-actions {
  padding: 9px 15px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--header-actions-border);
  font-size: 18px;

  .star {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
  }

  .icon {
    cursor: pointer;
  }
}

.scrollbar {
  height: calc(100% - 38px);
  width: 100%;
}

.container {
  font-size: 14px;
  padding: 10px 20px 0;

  @media (max-width: 1023px) {
    padding-left: 15px;
    padding-right: 15px;
  }

  .email-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .content {
    display: flex;
    flex-direction: column;

    .external-alert {
      margin-bottom: 12px;
      width: 100%;
      max-width: 980px;
      border-radius: 8px;

      :deep(.el-alert__title) {
        font-weight: 600;
      }
      :deep(.el-alert__description) {
        margin-top: 4px;
      }
    }

    .external-alert-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
    }

    .debug-state {
      opacity: 0.7;
      font-size: 12px;
    }

    .att {
      margin: 30px 0;
      border: 1px solid var(--light-border-color);
      padding: 14px;
      border-radius: 6px;
      width: fit-content;

      .att-box {
        min-width: min(410px, calc(100vw - 60px));
        max-width: 600px;
        display: grid;
        gap: 12px;
        grid-template-rows: 1fr;
      }

      .att-title {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;

        span:first-child {
          font-weight: bold;
        }
      }

      .att-item {
        cursor: pointer;
        background: var(--light-ill);
        padding: 5px 7px;
        border-radius: 4px;
        align-self: start;
        display: grid;
        grid-template-columns: auto 1fr auto auto;

        div {
          align-self: center;
        }

        .att-icon {
          display: grid;
        }

        .att-size {
          color: var(--secondary-text-color);
        }

        .att-name {
          margin: 0 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-all;
        }

        .opt-icon {
          padding-left: 10px;
          color: var(--secondary-text-color);
          align-items: center;
          display: flex;
          gap: 8px;

          a {
            color: var(--secondary-text-color);
            align-items: center;
            display: flex;
          }
        }
      }
    }

    .email-info {
      border-bottom: 1px solid var(--light-border-color);
      margin-bottom: 20px;
      padding-bottom: 8px;

      @media (max-width: 1024px) {
        margin-bottom: 15px;
      }

      .date {
        color: var(--regular-text-color);
        margin-bottom: 6px;
      }

      .email-msg {
        max-width: 400px;
        width: fit-content;
        margin-bottom: 15px;
      }

      .send {
        display: flex;
        margin-bottom: 6px;

        .send-name {
          color: var(--regular-text-color);
          display: flex;
          flex-wrap: wrap;
        }

        .send-name-title {
          padding-right: 5px;
        }
      }

      .receive {
        margin-bottom: 6px;
        display: flex;

        .receive-email {
          max-width: 700px;
          word-break: break-word;
        }

        span:nth-child(2) {
          color: var(--regular-text-color);
        }
      }

      .send-source,
      .source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }
    }
  }
}

.email-text {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.bottom-distance {
  margin-bottom: 30px;
}
</style>
