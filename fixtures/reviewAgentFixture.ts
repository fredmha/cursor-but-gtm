import { Campaign, TicketStatus } from '../types';

const isoDate = (date: Date) => date.toISOString().split('T')[0];

export const buildReviewAgentTestCampaign = (): Campaign => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const today = new Date(now);
  const overdueDate = new Date(weekStart);
  overdueDate.setDate(weekStart.getDate() - 2);

  const inWeek1 = new Date(weekStart);
  inWeek1.setDate(weekStart.getDate() + 1);
  const inWeek2 = new Date(weekStart);
  inWeek2.setDate(weekStart.getDate() + 3);
  const inWeek3 = new Date(weekStart);
  inWeek3.setDate(weekStart.getDate() + 5);
  const inWeek4 = new Date(weekStart);
  inWeek4.setDate(weekStart.getDate() + 6);
  const nextWeek = new Date(weekEnd);
  nextWeek.setDate(weekEnd.getDate() + 2);

  const createdAt = now.toISOString();
  const campaignId = 'test-campaign';

  return {
    id: campaignId,
    name: 'Review Agent Test Campaign',
    objective: 'Validate weekly and daily review flows',
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
    status: 'Active',
    channels: [
      {
        id: 'c_paid',
        name: 'Paid Social',
        campaignId,
        tickets: [
          {
            id: 't_paid_1',
            shortId: 'T-101',
            title: 'Launch prospecting ads',
            description: 'Set up ad set targeting and budgets.',
            status: TicketStatus.Todo,
            channelId: 'c_paid',
            assigneeId: 'u1',
            priority: 'High',
            dueDate: isoDate(inWeek1),
            createdAt
          },
          {
            id: 't_paid_2',
            shortId: 'T-102',
            title: 'Refresh creative tests',
            description: 'New variations for top ads.',
            status: TicketStatus.InProgress,
            channelId: 'c_paid',
            assigneeId: 'u2',
            priority: 'Medium',
            dueDate: isoDate(inWeek2),
            createdAt
          },
          {
            id: 't_paid_3',
            shortId: 'T-103',
            title: 'Build retargeting list',
            description: 'Create segment for site visitors.',
            status: TicketStatus.Backlog,
            channelId: 'c_paid',
            assigneeId: 'u3',
            priority: 'Low',
            dueDate: isoDate(inWeek3),
            createdAt
          },
          {
            id: 't_paid_4',
            shortId: 'T-104',
            title: 'QA conversion tracking',
            description: 'Verify pixel and server events.',
            status: TicketStatus.Done,
            channelId: 'c_paid',
            assigneeId: 'u4',
            priority: 'Medium',
            dueDate: isoDate(inWeek4),
            createdAt
          },
          {
            id: 't_paid_5',
            shortId: 'T-105',
            title: 'Plan next-week budget',
            description: 'Allocate spend by campaign.',
            status: TicketStatus.Todo,
            channelId: 'c_paid',
            assigneeId: 'u1',
            priority: 'Medium',
            dueDate: isoDate(nextWeek),
            createdAt
          }
        ],
        principles: [],
        tags: [],
        links: [],
        notes: [],
        memberIds: []
      },
      {
        id: 'c_content',
        name: 'Content',
        campaignId,
        tickets: [
          {
            id: 't_content_1',
            shortId: 'T-201',
            title: 'Publish weekly newsletter',
            description: 'Draft and send the weekly update.',
            status: TicketStatus.Todo,
            channelId: 'c_content',
            assigneeId: 'u1',
            priority: 'High',
            dueDate: isoDate(today),
            createdAt
          }
        ],
        principles: [],
        tags: [],
        links: [],
        notes: [],
        memberIds: []
      }
    ],
    projects: [
      {
        id: 'p_site',
        name: 'Website Refresh',
        description: 'Improve landing page conversion rate.',
        status: 'On Track',
        startDate: isoDate(weekStart),
        targetDate: isoDate(nextWeek),
        updates: [],
        tickets: [
          {
            id: 't_proj_1',
            shortId: 'T-301',
            title: 'Rewrite hero section',
            description: 'Focus on value prop clarity.',
            status: TicketStatus.InProgress,
            projectId: 'p_site',
            assigneeId: 'u1',
            priority: 'High',
            dueDate: isoDate(inWeek2),
            createdAt
          },
          {
            id: 't_proj_2',
            shortId: 'T-302',
            title: 'Audit CTA performance',
            description: 'Review click-through trends.',
            status: TicketStatus.Todo,
            projectId: 'p_site',
            assigneeId: 'u1',
            priority: 'Medium',
            dueDate: isoDate(overdueDate),
            createdAt
          },
          {
            id: 't_proj_3',
            shortId: 'T-303',
            title: 'Set up A/B test',
            description: 'Prepare experiment for next week.',
            status: TicketStatus.Todo,
            projectId: 'p_site',
            assigneeId: 'u2',
            priority: 'Medium',
            dueDate: isoDate(nextWeek),
            createdAt
          }
        ]
      }
    ],
    principles: [],
    roadmapItems: [
      {
        id: 'r1',
        channelId: 'c_paid',
        weekIndex: 0,
        durationWeeks: 2,
        title: 'Prospecting Phase 1',
        description: 'Initial ad launch and testing.',
        ownerIds: ['u1'],
        type: 'CONTENT',
        priority: 'High'
      },
      {
        id: 'r2',
        channelId: 'c_paid',
        weekIndex: 2,
        durationWeeks: 1,
        title: 'Retargeting Setup',
        description: 'Building the mid-funnel content.',
        ownerIds: ['u3'],
        type: 'CONTENT',
        priority: 'Medium'
      },
      {
        id: 'r3',
        channelId: 'c_content',
        weekIndex: 0,
        durationWeeks: 4,
        title: 'Weekly Newsletter Series',
        description: 'Consistency in email distribution.',
        ownerIds: ['u1'],
        type: 'CONTENT',
        priority: 'High'
      },
      {
        id: 'r4',
        projectId: 'p_site',
        weekIndex: 1,
        durationWeeks: 2,
        title: 'Hero Section Overhaul',
        description: 'Main landing page structural changes.',
        ownerIds: ['u1'],
        type: 'LAUNCH',
        priority: 'Urgent'
      }
    ],
    timelineTags: [
      {
        id: 'tag1',
        weekIndex: 0,
        label: 'LAUNCH',
        title: 'Campaign Kickoff',
        color: 'bg-emerald-500'
      },
      {
        id: 'tag2',
        weekIndex: 3,
        label: 'EVENT',
        title: 'Project Milestone',
        color: 'bg-indigo-500'
      }
    ],
    docFolders: [
      {
        id: 'f_strategy',
        name: 'Strategy',
        icon: 'S',
        createdAt
      }
    ],
    docs: [],
    availableTags: ['Draft', 'Urgent'],
    dailyChatHistory: [],
    weeklyChatHistory: []
  };
};
