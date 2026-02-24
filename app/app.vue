<script setup lang="ts">
import { ref, onMounted, watch } from "vue";

type ThemeMode = "light" | "dark";
const theme = ref<ThemeMode>("light");

const user = useState<any | null>("user", () => null);

onMounted(() => {
  // theme
  const savedTheme = localStorage.getItem("uw-theme") as ThemeMode | null;
  if (savedTheme === "dark" || savedTheme === "light") theme.value = savedTheme;
  document.documentElement.classList.toggle(
    "theme-dark",
    theme.value === "dark",
  );

  // user
  const savedUser = localStorage.getItem("uw-user");
  if (savedUser) {
    try {
      user.value = JSON.parse(savedUser);
    } catch {}
  }
});

watch(theme, (v) => {
  document.documentElement.classList.toggle("theme-dark", v === "dark");
  localStorage.setItem("uw-theme", v);
});

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

// auth modal (same behavior: find-or-create)
type AuthMode = "signup" | "login";
const authOpen = ref(false);
const authMode = ref<AuthMode>("signup");
const email = ref("");
const loading = ref(false);
const errorMsg = ref<string | null>(null);

function openAuth(mode: AuthMode) {
  authMode.value = mode;
  authOpen.value = true;
  errorMsg.value = null;
  email.value = user.value?.email ?? "";
}

function closeAuth() {
  authOpen.value = false;
  loading.value = false;
  errorMsg.value = null;
}

async function submitAuth() {
  errorMsg.value = null;
  const e = email.value.trim().toLowerCase();
  if (!e) return (errorMsg.value = "Email is required.");

  loading.value = true;
  try {
    const res: any = await $fetch("/api/register", {
      method: "POST",
      body: { email: e },
    });
    user.value = res.user;
    localStorage.setItem("uw-user", JSON.stringify(res.user));
    closeAuth();
  } catch (err: any) {
    errorMsg.value =
      err?.data?.statusMessage ?? err?.message ?? "Something went wrong.";
  } finally {
    loading.value = false;
  }
}

function logout() {
  user.value = null;
  localStorage.removeItem("uw-user");
}
</script>

<template>
  <div class="min-h-screen bg-nuxt-bg text-nuxt-text pt-4">
    <!-- Top bar -->
    <header class="border-b border-nuxt-border bg-nuxt-bg">
      <div
        class="mx-auto flex max-w-6xl items-center justify-between px-6 py-6"
      >
        <!-- Logo (click -> homepage) -->
        <NuxtLink to="/" class="flex items-center gap-3 hover:opacity-90">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-nuxt-green font-bold text-black"
          >
            U
          </div>
          <div class="leading-tight">
            <div class="text-base font-semibold">Uniwire Demo</div>
            <div class="text-xs text-nuxt-muted">
              Nuxt full-stack • invoices via API
            </div>
          </div>
        </NuxtLink>

        <!-- Right controls -->
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-nuxt-border bg-nuxt-panel hover:opacity-90"
            @click="toggleTheme"
            title="Toggle theme"
          >
            <span class="text-xl leading-none">{{
              theme === "dark" ? "☀️" : "🌙"
            }}</span>
          </button>

          <template v-if="!user">
            <button
              class="h-10 rounded-lg bg-nuxt-green px-4 text-sm font-semibold text-black hover:opacity-90"
              @click="openAuth('signup')"
            >
              Sign up
            </button>
            <button
              class="h-10 rounded-lg border border-nuxt-border bg-nuxt-panel px-4 text-sm font-semibold hover:opacity-90"
              @click="openAuth('login')"
            >
              Login
            </button>
          </template>

          <template v-else>
            <div class="hidden sm:flex items-center gap-2 text-sm">
              <span
                class="inline-block h-2 w-2 rounded-full bg-nuxt-green"
              ></span>
              <span class="text-nuxt-muted">{{ user.email }}</span>
              <span class="text-nuxt-muted">•</span>
              <span class="text-nuxt-muted">ID</span>
              <span class="font-semibold">{{ user.idFormatted }}</span>
            </div>
            <button
              class="h-10 rounded-lg border border-nuxt-border bg-nuxt-panel px-4 text-sm font-semibold hover:opacity-90"
              @click="logout"
            >
              Logout
            </button>
          </template>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mx-auto max-w-6xl px-6 pt-2 pb-6">
        <nav class="flex gap-3">
          <NuxtLink
            to="/"
            class="rounded-xl px-4 py-2 text-sm hover:bg-nuxt-panel"
            active-class="bg-nuxt-panel"
          >
            Dashboard
          </NuxtLink>
          <NuxtLink
            to="/deposit"
            class="rounded-xl px-4 py-2 text-sm hover:bg-nuxt-panel"
            active-class="bg-nuxt-panel"
          >
            Deposit
          </NuxtLink>
          <NuxtLink
            to="/withdraw"
            class="rounded-xl px-4 py-2 text-sm hover:bg-nuxt-panel"
            active-class="bg-nuxt-panel"
          >
            Withdraw
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
      <NuxtPage />
    </main>

    <!-- Auth modal -->
    <div
      v-if="authOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      @click.self="closeAuth"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-nuxt-border bg-nuxt-panel p-6 shadow-xl"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold">
              {{ authMode === "signup" ? "Sign up" : "Login" }}
            </h2>
            <p class="mt-1 text-sm text-nuxt-muted">
              Enter your email to continue.
            </p>
          </div>
          <button
            class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-1 text-sm hover:opacity-90"
            @click="closeAuth"
          >
            ✕
          </button>
        </div>

        <div class="mt-5">
          <label class="text-sm text-nuxt-muted">Email</label>
          <input
            v-model="email"
            type="email"
            class="mt-2 w-full rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-nuxt-text outline-none focus:ring-2 focus:ring-nuxt-green/50"
            @keydown.enter="submitAuth"
          />
          <p v-if="errorMsg" class="mt-2 text-sm text-red-400">
            {{ errorMsg }}
          </p>
        </div>

        <div class="mt-6 flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-nuxt-border bg-nuxt-bg px-4 py-2 text-sm font-semibold hover:opacity-90"
            @click="closeAuth"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            class="rounded-lg bg-nuxt-green px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
            @click="submitAuth"
            :disabled="loading"
          >
            {{
              loading
                ? "Please wait…"
                : authMode === "signup"
                  ? "Sign up"
                  : "Login"
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
