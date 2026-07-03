import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import Layout from "@/app/layout"
import AuthLayout from "@/app/(auth)/layout"
import { AuthGuard } from "@/app/(auth)/components/AuthGuard"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Loader2 } from "lucide-react"

// Lazy-loaded pages
const DashboardPage = lazy(() => import("@/app/dashboard/page"))
const LoginPage = lazy(() => import("@/app/(auth)/login/page"))
const UsersPage = lazy(() => import("@/app/users/pages/page"))
const ProjectsPage = lazy(() => import("@/app/projects/page"))
const CreateProjectPage = lazy(() => import("@/app/projects/create-project-page"))
const EditProjectPage = lazy(() => import("@/app/projects/edit-project-page"))
const ProjectDetailsPage = lazy(() => import("@/app/projects/project-details-page"))
const KanbanBoardPage = lazy(() => import("@/app/projects/kanban-board-page"))
const TasksPage = lazy(() => import("@/app/tasks/pages/page"))
const TaskDetailPage = lazy(() => import("@/app/tasks/pages/task-detail-page"))
const HelpRequestsPage = lazy(() => import("@/app/help-requests/pages/page"))
// Detail page for GET /help-requests/{id}
const HelpRequestDetailPage = lazy(() => import("@/app/help-requests/pages/help-request-detail-page"))
const TicketsPage = lazy(() => import("@/app/tickets/page"))
const RatingsConfigurationsPage = lazy(() => import("@/app/ratings/configurations/page"))
const ConfigurationDetailPage = lazy(() => import("@/app/ratings/configurations/configuration-detail"))
const CreateConfigurationPage = lazy(() => import("@/app/ratings/configurations/create-configuration"))
const EditConfigurationPage = lazy(() => import("@/app/ratings/configurations/edit-configuration"))
const RatingsPage = lazy(() => import("@/app/ratings/ratings/page"))
const TaskRatingPage = lazy(() => import("@/app/ratings/ratings/task-rating-page"))
const FinalRatingsPage = lazy(() => import("@/app/ratings/final-ratings/page"))
const WeightedRatingsPage = lazy(() => import("@/app/ratings/weighted-ratings/page"))
const ClockingInOutPage = lazy(() => import("@/app/clocking/in-out/page"))
const ClockingRecordsPage = lazy(() => import("@/app/clocking/records/page"))
const ClockingSessionsPage = lazy(() => import("@/app/clocking/sessions/page"))
const RolesPage = lazy(() => import("@/app/roles/page"))
const WorkspacesPage = lazy(() => import("@/app/workspaces/page"))
const CreateWorkspacePage = lazy(() => import("@/app/workspaces/create-workspace-page"))
const EditWorkspacePage = lazy(() => import("@/app/workspaces/edit-workspace-page"))
const WorkspaceDetailsPage = lazy(() => import("@/app/workspaces/workspace-details-page"))
const CreateTodoPage = lazy(() => import("@/app/workspaces/create-todo-page"))
const EditTodoPage = lazy(() => import("@/app/workspaces/edit-todo-page"))
const TodoDetailPage = lazy(() => import("@/app/workspaces/todo-detail-page"))
const AccountPage = lazy(() => import("@/app/account/page"))
const NotFoundPage = lazy(() => import("@/app/not-found"))
const SupportTicketPage = lazy(() => import("@/app/tickets/pages/support-ticket-page"))

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <TooltipProvider>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="login" element={<LoginPage />} />
                </Route>
                {/* Public support ticket page — no auth required */}
                <Route path="support-ticket" element={<SupportTicketPage />} />
                <Route element={<AuthGuard><Layout /></AuthGuard>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="users/create" element={<ProtectedRoute permission="create users" fallback={<Navigate to="/users" replace />}><UsersPage /></ProtectedRoute>} />
                  <Route path="users/:id/edit" element={<ProtectedRoute permission="edit users" fallback={<Navigate to="/users" replace />}><UsersPage /></ProtectedRoute>} />
                  <Route path="projects" element={<ProtectedRoute permission="view projects"><ProjectsPage /></ProtectedRoute>} />
                  <Route path="projects/create" element={<ProtectedRoute permission="create projects"><CreateProjectPage /></ProtectedRoute>} />
                  <Route path="projects/:id/edit" element={<ProtectedRoute permission="edit projects"><EditProjectPage /></ProtectedRoute>} />
                  <Route path="projects/:id" element={<ProtectedRoute permission="view projects"><ProjectDetailsPage /></ProtectedRoute>} />
                  {/* Support both routes so old links and new links both work. */}
                  <Route path="projects/:id/kanban" element={<ProtectedRoute permission="view projects"><KanbanBoardPage /></ProtectedRoute>} />
                  <Route path="projects/:id/kanban-board" element={<ProtectedRoute permission="view projects"><KanbanBoardPage /></ProtectedRoute>} />
                  <Route path="tasks" element={<ProtectedRoute permission="view tasks"><TasksPage /></ProtectedRoute>} />
                  <Route path="tasks/create" element={<ProtectedRoute permission="create tasks"><TasksPage /></ProtectedRoute>} />
                  <Route path="tasks/:id/edit" element={<ProtectedRoute permission="edit tasks"><TasksPage /></ProtectedRoute>} />
                  <Route path="tasks/:id/rate" element={<ProtectedRoute permission="create task ratings"><TasksPage /></ProtectedRoute>} />
                  <Route path="tasks/:id" element={<ProtectedRoute permission="view tasks"><TaskDetailPage /></ProtectedRoute>} />
                  <Route path="help-requests" element={<ProtectedRoute permission="view help requests"><HelpRequestsPage /></ProtectedRoute>} />
                  {/* Detail page for a single help request — GET /help-requests/{id} */}
                  <Route path="help-requests/:id" element={<ProtectedRoute permission="view help requests"><HelpRequestDetailPage /></ProtectedRoute>} />
                  <Route path="tickets" element={<ProtectedRoute permission="view tickets"><TicketsPage /></ProtectedRoute>} />
                  <Route path="tickets/create" element={<ProtectedRoute permission="create help requests"><TicketsPage /></ProtectedRoute>} />
                  <Route path="tickets/:id" element={<ProtectedRoute permission="view tickets"><TicketsPage /></ProtectedRoute>} />
                  <Route path="tickets/:id/edit" element={<ProtectedRoute permission="edit tickets"><TicketsPage /></ProtectedRoute>} />
                  <Route path="ratings/configurations" element={<ProtectedRoute permission="view rating configs"><RatingsConfigurationsPage /></ProtectedRoute>} />
                  <Route path="ratings/configurations/new" element={<ProtectedRoute permission="create rating configs"><CreateConfigurationPage /></ProtectedRoute>} />
                  <Route path="ratings/configurations/:id" element={<ProtectedRoute permission="view rating configs"><ConfigurationDetailPage /></ProtectedRoute>} />
                  <Route path="ratings/configurations/:id/edit" element={<ProtectedRoute permission="edit rating configs"><EditConfigurationPage /></ProtectedRoute>} />
                  <Route path="ratings" element={<ProtectedRoute permissions={["create task ratings", "create stakeholder ratings"]} requireAll={false}><RatingsPage /></ProtectedRoute>} />
                  {/* Rating form for a specific task — GET /tasks/:id then POST/PUT /task-ratings */}
                  <Route path="ratings/tasks/:taskId/rate" element={<ProtectedRoute permissions={["create task ratings", "view tasks"]} requireAll={true}><TaskRatingPage /></ProtectedRoute>} />
                  <Route path="ratings/final-ratings" element={<ProtectedRoute permission="calculate final ratings"><FinalRatingsPage /></ProtectedRoute>} />
                  <Route path="ratings/weighted-ratings" element={<ProtectedRoute permission="calculate final ratings"><WeightedRatingsPage /></ProtectedRoute>} />
                  <Route path="clocking/in-out" element={<ClockingInOutPage />} />
                  <Route path="clocking/records" element={<ClockingRecordsPage />} />
                  <Route path="clocking/sessions" element={<ProtectedRoute permission="view all clocking sessions"><ClockingSessionsPage /></ProtectedRoute>} />
                  <Route path="roles" element={<ProtectedRoute permission="view roles"><RolesPage /></ProtectedRoute>} />
                  <Route path="workspaces" element={<WorkspacesPage />} />
                  <Route path="workspaces/create" element={<CreateWorkspacePage />} />
                  <Route path="workspaces/:id/edit" element={<EditWorkspacePage />} />
                  <Route path="workspaces/:id" element={<WorkspaceDetailsPage />} />
                  <Route path="workspaces/:id/todos/create" element={<CreateTodoPage />} />
                  <Route path="workspaces/:id/todos/:todoId/edit" element={<EditTodoPage />} />
                  <Route path="workspaces/:id/todos/:todoId" element={<TodoDetailPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
