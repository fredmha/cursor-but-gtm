
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Campaign, Channel, Bet, Ticket, TicketStatus, Status, User, Priority, RoadmapItem, Project, ProjectUpdate, ChannelLink, ChannelNote, TimelineTag } from './types';

// Safe ID Generator for environments without secure context
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails (e.g. non-secure context)
    }
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Mock Users
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Founder', initials: 'FD', color: 'bg-indigo-500' },
  { id: 'u2', name: 'Growth Lead', initials: 'GL', color: 'bg-emerald-500' },
  { id: 'u3', name: 'Engineer', initials: 'EN', color: 'bg-purple-500' },
  { id: 'u4', name: 'Designer', initials: 'DS', color: 'bg-pink-500' },
];

interface StoreState {
  campaign: Campaign | null;
  users: User[];
  currentUser: User;
  setCampaign: (campaign: Campaign) => void;
  updateCampaign: (updates: Partial<Campaign>) => void;
  
  // Execution Actions
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  deleteChannel: (channelId: string) => void;
  addChannelPrinciple: (channelId: string, text: string) => void;
  deleteChannelPrinciple: (channelId: string, principleId: string) => void;
  addChannelLink: (channelId: string, link: ChannelLink) => void;
  removeChannelLink: (channelId: string, linkId: string) => void;
  addChannelNote: (channelId: string, note: ChannelNote) => void;
  deleteChannelNote: (channelId: string, noteId: string) => void;
  addChannelMember: (channelId: string, userId: string) => void;
  removeChannelMember: (channelId: string, userId: string) => void;
  
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  addProjectUpdate: (projectId: string, update: ProjectUpdate) => void;
  
  // Project Ticket Actions
  addProjectTicket: (projectId: string, ticket: Ticket) => void;
  updateProjectTicket: (projectId: string, ticketId: string, updates: Partial<Ticket>) => void;
  deleteProjectTicket: (projectId: string, ticketId: string) => void;

  addBet: (channelId: string, bet: Bet) => void;
  updateBet: (channelId: string, betId: string, updates: Partial<Bet>) => void;
  
  addTicket: (channelId: string, betId: string, ticket: Ticket) => void;
  updateTicket: (channelId: string, betId: string, ticketId: string, updates: Partial<Ticket>) => void;
  deleteTicket: (channelId: string, betId: string, ticketId: string) => void;
  
  // Roadmap Actions
  addRoadmapItem: (item: RoadmapItem) => void;
  updateRoadmapItem: (itemId: string, updates: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (itemId: string) => void;
  moveRoadmapItem: (itemId: string, newChannelId: string, newWeekIndex: number) => void;
  
  // Timeline Tag Actions
  addTimelineTag: (tag: TimelineTag) => void;
  deleteTimelineTag: (tagId: string) => void;

  importAIPlan: (channelsData: any[]) => void;
  switchUser: (userId: string) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users] = useState<User[]>(MOCK_USERS);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);

  const [campaign, setCampaignState] = useState<Campaign | null>(() => {
    const saved = localStorage.getItem('gtm-os-campaign');
    if (!saved) return null;
    
    // MIGRATION LOGIC ON LOAD
    const data = JSON.parse(saved);
    
    // Ensure all channels have arrays
    if (data.channels) {
        data.channels = data.channels.map((c: any) => ({
            ...c,
            principles: c.principles || [],
            tags: c.tags || [],
            links: c.links || [],
            notes: c.notes || [],
            memberIds: c.memberIds || []
        }));
    }

    // Ensure projects array exists
    if (!data.projects) {
        data.projects = [];
    } else {
        // Ensure tickets array exists on projects
        data.projects = data.projects.map((p: any) => ({
            ...p,
            tickets: p.tickets || []
        }));
    }

    if (!data.timelineTags) {
        data.timelineTags = [];
    }

    return data;
  });

  useEffect(() => {
    if (campaign) {
      localStorage.setItem('gtm-os-campaign', JSON.stringify(campaign));
    } else {
      localStorage.removeItem('gtm-os-campaign');
    }
  }, [campaign]);

  const setCampaign = (c: Campaign) => setCampaignState(c);

  const updateCampaign = (updates: Partial<Campaign>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({ ...prev, ...updates }) : null);
  };

  const addChannel = (channel: Channel) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: [...prev.channels, { 
          ...channel, 
          principles: channel.principles || [], 
          tags: channel.tags || [], 
          links: [], 
          notes: [],
          memberIds: []
      }]
    }) : null);
  };

  const updateChannel = (channelId: string, updates: Partial<Channel>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => c.id === channelId ? { ...c, ...updates } : c)
    }) : null);
  };

  const deleteChannel = (channelId: string) => {
    if (!campaign) return;
    const newChannels = campaign.channels.filter(c => c.id !== channelId);
    const newRoadmapItems = (campaign.roadmapItems || []).filter(i => i.channelId !== channelId);
    
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: newChannels,
      roadmapItems: newRoadmapItems
    }) : null);
  };

  const addChannelPrinciple = (channelId: string, text: string) => {
    if (!campaign) return;
    const principle = { id: generateId(), text };
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, principles: [...(c.principles || []), principle] } : c
      )
    }) : null);
  };

  const deleteChannelPrinciple = (channelId: string, principleId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, principles: (c.principles || []).filter(p => p.id !== principleId) } : c
      )
    }) : null);
  };

  const addChannelLink = (channelId: string, link: ChannelLink) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, links: [...(c.links || []), link] } : c
      )
    }) : null);
  };

  const removeChannelLink = (channelId: string, linkId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, links: (c.links || []).filter(l => l.id !== linkId) } : c
      )
    }) : null);
  };

  const addChannelNote = (channelId: string, note: ChannelNote) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, notes: [note, ...(c.notes || [])] } : c
      )
    }) : null);
  };

  const deleteChannelNote = (channelId: string, noteId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, notes: (c.notes || []).filter(n => n.id !== noteId) } : c
      )
    }) : null);
  };

  const addChannelMember = (channelId: string, userId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          channels: prev.channels.map(c => {
              if (c.id !== channelId) return c;
              const currentMembers = c.memberIds || [];
              if (currentMembers.includes(userId)) return c;
              return { ...c, memberIds: [...currentMembers, userId] };
          })
      }) : null);
  };

  const removeChannelMember = (channelId: string, userId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          channels: prev.channels.map(c => {
              if (c.id !== channelId) return c;
              return { ...c, memberIds: (c.memberIds || []).filter(id => id !== userId) };
          })
      }) : null);
  };

  const addProject = (project: Project) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: [...(prev.projects || []), { ...project, tickets: [] }]
    }) : null);
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: (prev.projects || []).map(p => p.id === projectId ? { ...p, ...updates } : p)
    }) : null);
  };

  const deleteProject = (projectId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: (prev.projects || []).filter(p => p.id !== projectId),
      roadmapItems: (prev.roadmapItems || []).filter(i => i.projectId !== projectId)
    }) : null);
  };

  const addProjectUpdate = (projectId: string, update: ProjectUpdate) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: (prev.projects || []).map(p => p.id === projectId ? {
        ...p,
        updates: [update, ...(p.updates || [])]
      } : p)
    }) : null);
  };

  // NEW: Project Ticket Logic
  const addProjectTicket = (projectId: string, ticket: Ticket) => {
    if (!campaign) return;
    
    // Auto-create roadmap item if needed
    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    const finalTicket = { ...ticket, projectId };

    if (!finalTicket.roadmapItemId) {
        const newItemId = generateId();
        finalTicket.roadmapItemId = newItemId;
        
        const newItem: RoadmapItem = {
            id: newItemId,
            channelId: undefined, // IMPORTANT: No channel means "Strategy Horizon"
            weekIndex: 0, 
            durationWeeks: 1,
            title: ticket.title,
            description: ticket.description,
            type: 'CONTENT',
            linkedBetId: undefined,
            ticketId: finalTicket.id,
            projectId: projectId,
            status: ticket.status === TicketStatus.Done ? Status.Completed : Status.Active,
            ownerIds: ticket.assigneeId ? [ticket.assigneeId] : [],
            priority: ticket.priority,
            label: 'Task'
        };
        newRoadmapItems.push(newItem);
    }

    setCampaignState(prev => prev ? ({
        ...prev,
        roadmapItems: newRoadmapItems,
        projects: prev.projects.map(p => p.id === projectId ? {
            ...p,
            tickets: [...(p.tickets || []), finalTicket]
        } : p)
    }) : null);
  };

  const updateProjectTicket = (projectId: string, ticketId: string, updates: Partial<Ticket>) => {
      if (!campaign) return;
      
      let newRoadmapItems = [...(campaign.roadmapItems || [])];
      const rItemIndex = newRoadmapItems.findIndex(i => i.ticketId === ticketId);
      
      if (rItemIndex !== -1) {
          const rItem = newRoadmapItems[rItemIndex];
          let updatedRItem = { ...rItem };
          let changed = false;

          if (updates.status) {
              if (updates.status === TicketStatus.Done) {
                  updatedRItem.status = Status.Completed;
                  changed = true;
              } else if (rItem.status === Status.Completed) {
                  updatedRItem.status = Status.Active;
                  changed = true;
              }
          }
          if (updates.title) {
              updatedRItem.title = updates.title;
              changed = true;
          }
          if (updates.assigneeId) {
              updatedRItem.ownerIds = [updates.assigneeId];
              changed = true;
          }
          if (changed) newRoadmapItems[rItemIndex] = updatedRItem;
      }

      setCampaignState(prev => prev ? ({
          ...prev,
          roadmapItems: newRoadmapItems,
          projects: prev.projects.map(p => p.id === projectId ? {
              ...p,
              tickets: p.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
          } : p)
      }) : null);
  };

  const deleteProjectTicket = (projectId: string, ticketId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          roadmapItems: prev.roadmapItems.filter(i => i.ticketId !== ticketId),
          projects: prev.projects.map(p => p.id === projectId ? {
              ...p,
              tickets: p.tickets.filter(t => t.id !== ticketId)
          } : p)
      }) : null);
  };

  const addBet = (channelId: string, bet: Bet) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, bets: [...c.bets, bet] } : c
      )
    }) : null);
  };

  const updateBet = (channelId: string, betId: string, updates: Partial<Bet>) => {
    if (!campaign) return;

    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    const linkedItemIndex = newRoadmapItems.findIndex(i => i.linkedBetId === betId && i.type === 'BET');
    
    if (linkedItemIndex !== -1) {
        const item = newRoadmapItems[linkedItemIndex];
        const updatedItem = { ...item };
        if (updates.description) updatedItem.title = updates.description;
        if (updates.status) updatedItem.status = updates.status;
        newRoadmapItems[linkedItemIndex] = updatedItem;
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? {
          ...c,
          bets: c.bets.map(b => b.id === betId ? { ...b, ...updates } : b)
        } : c
      ),
      roadmapItems: newRoadmapItems
    }) : null);
  };

  const addTicket = (channelId: string, betId: string, ticket: Ticket) => {
    if (!campaign) return;
    const shortId = `T-${Math.floor(Math.random() * 1000)}`;
    const finalTicket = { ...ticket, shortId, channelId };

    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    
    if (!finalTicket.roadmapItemId) {
        const newItemId = generateId();
        finalTicket.roadmapItemId = newItemId;
        
        const newItem: RoadmapItem = {
            id: newItemId,
            channelId: channelId,
            weekIndex: 0, 
            durationWeeks: 1,
            title: ticket.title,
            description: ticket.description,
            type: 'CONTENT',
            linkedBetId: betId,
            ticketId: finalTicket.id,
            projectId: ticket.projectId,
            status: ticket.status === TicketStatus.Done ? Status.Completed : Status.Active,
            ownerIds: ticket.assigneeId ? [ticket.assigneeId] : [],
            priority: ticket.priority,
            label: 'Task'
        };
        newRoadmapItems.push(newItem);
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c => 
        c.id === channelId ? {
          ...c,
          bets: c.bets.map(b => b.id === betId ? { ...b, tickets: [...b.tickets, finalTicket] } : b)
        } : c
      )
    }) : null);
  };

  const updateTicket = (channelId: string, betId: string, ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;
    
    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    const rItemIndex = newRoadmapItems.findIndex(i => i.ticketId === ticketId);
    
    if (rItemIndex !== -1) {
         const rItem = newRoadmapItems[rItemIndex];
         let updatedRItem = { ...rItem };
         let changed = false;

         if (updates.status) {
             if (updates.status === TicketStatus.Done) {
                 updatedRItem.status = Status.Completed;
                 changed = true;
             } else if (rItem.status === Status.Completed) {
                 updatedRItem.status = Status.Active;
                 changed = true;
             }
         }
         if (updates.title) {
             updatedRItem.title = updates.title;
             changed = true;
         }
         if (updates.assigneeId) {
             updatedRItem.ownerIds = [updates.assigneeId];
             changed = true;
         }
         if (changed) {
             newRoadmapItems[rItemIndex] = updatedRItem;
         }
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c => 
        c.id === channelId ? {
          ...c,
          bets: c.bets.map(b => b.id === betId ? {
            ...b,
            tickets: b.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
          } : b)
        } : c
      )
    }) : null);
  };

  const deleteTicket = (channelId: string, betId: string, ticketId: string) => {
    if (!campaign) return;
    const newRoadmapItems = (campaign.roadmapItems || []).filter(i => i.ticketId !== ticketId);

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c => 
        c.id === channelId ? {
          ...c,
          bets: c.bets.map(b => b.id === betId ? {
            ...b,
            tickets: b.tickets.filter(t => t.id !== ticketId)
          } : b)
        } : c
      )
    }) : null);
  };

  const addRoadmapItem = (item: RoadmapItem) => {
    if (!campaign) return;
    let newItem = { ...item };
    
    // SYNC: Create Ticket if linked to Bet and doesn't have a ticketId
    if (newItem.linkedBetId && !newItem.ticketId) {
        // Find the bet to get context
        const bet = campaign.channels.flatMap(c => c.bets).find(b => b.id === newItem.linkedBetId);
        if (bet) {
             const ticketId = generateId();
             const ticket: Ticket = {
                 id: ticketId,
                 shortId: `T-${Math.floor(Math.random() * 10000)}`,
                 title: newItem.title,
                 description: newItem.description,
                 status: TicketStatus.Todo,
                 betId: bet.id,
                 channelId: bet.channelId,
                 projectId: bet.projectId,
                 roadmapItemId: newItem.id,
                 assigneeId: newItem.ownerIds?.[0],
                 priority: newItem.priority || 'Medium',
                 createdAt: new Date().toISOString()
             };
             
             newItem.ticketId = ticketId;
             
             // Update store with both new item and new ticket
             setCampaignState(prev => {
                 if (!prev) return null;
                 const newChannels = prev.channels.map(c => 
                     c.id === bet.channelId ? {
                         ...c,
                         bets: c.bets.map(b => b.id === bet.id ? { ...b, tickets: [...b.tickets, ticket] } : b)
                     } : c
                 );
                 return {
                     ...prev,
                     channels: newChannels,
                     roadmapItems: [...(prev.roadmapItems || []), newItem]
                 };
             });
             return;
        }
    } else if (newItem.projectId && !newItem.channelId && !newItem.ticketId) {
        // PROJECT ONLY TICKET
        const ticketId = generateId();
        const ticket: Ticket = {
            id: ticketId,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: newItem.title,
            description: newItem.description,
            status: TicketStatus.Todo,
            projectId: newItem.projectId,
            roadmapItemId: newItem.id,
            assigneeId: newItem.ownerIds?.[0],
            priority: newItem.priority || 'Medium',
            createdAt: new Date().toISOString()
        };
        newItem.ticketId = ticketId;
        
        setCampaignState(prev => prev ? ({
            ...prev,
            roadmapItems: [...(prev.roadmapItems || []), newItem],
            projects: prev.projects.map(p => p.id === newItem.projectId ? {
                ...p,
                tickets: [...(p.tickets || []), ticket]
            } : p)
        }) : null);
        return;
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: [...(prev.roadmapItems || []), newItem]
    }) : null);
  };

  const updateRoadmapItem = (itemId: string, updates: Partial<RoadmapItem>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: (prev.roadmapItems || []).map(i => i.id === itemId ? { ...i, ...updates } : i)
    }) : null);
  };

  const moveRoadmapItem = (itemId: string, newChannelId: string, newWeekIndex: number) => {
    // Note: If item is Project-Only (no channelId), moving it to a channel might require data migration (creating Bet link).
    // For now, assume we just update properties.
    updateRoadmapItem(itemId, { channelId: newChannelId, weekIndex: newWeekIndex });
  };

  const deleteRoadmapItem = (itemId: string) => {
    if (!campaign) return;
    const item = campaign.roadmapItems.find(i => i.id === itemId);
    let newChannels = [...campaign.channels];
    let newProjects = [...campaign.projects];

    if (item && item.ticketId) {
         if (item.channelId) {
             newChannels = newChannels.map(c => ({
                 ...c,
                 bets: c.bets.map(b => ({
                     ...b,
                     tickets: b.tickets.filter(t => t.id !== item.ticketId)
                 }))
             }));
         } else if (item.projectId) {
             newProjects = newProjects.map(p => ({
                 ...p,
                 tickets: p.tickets.filter(t => t.id !== item.ticketId)
             }));
         }
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      channels: newChannels,
      projects: newProjects,
      roadmapItems: (prev.roadmapItems || []).filter(i => i.id !== itemId)
    }) : null);
  };

  const addTimelineTag = (tag: TimelineTag) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        timelineTags: [...(prev.timelineTags || []), tag]
    }) : null);
  };

  const deleteTimelineTag = (tagId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        timelineTags: (prev.timelineTags || []).filter(t => t.id !== tagId)
    }) : null);
  };

  const importAIPlan = (channelsData: any[]) => {
    if (!campaign) return;
    const newChannels: Channel[] = channelsData.map((c: any) => ({
      id: generateId(),
      name: c.name,
      campaignId: campaign.id,
      bets: c.bets.map((b: any) => ({
        id: generateId(),
        description: b.description,
        hypothesis: b.hypothesis,
        successCriteria: 'Define success metric',
        status: Status.Draft,
        channelId: '', // Set in loop below
        tickets: [],
        ownerId: currentUser.id,
        timeboxWeeks: 2
      })),
      principles: [],
      tags: [],
      links: [],
      notes: [],
      memberIds: []
    }));
    
    newChannels.forEach(c => {
      c.bets.forEach(b => b.channelId = c.id);
    });

    setCampaignState(prev => prev ? ({
      ...prev,
      channels: [...prev.channels, ...newChannels]
    }) : null);
  };

  const switchUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const reset = () => {
    setCampaignState(null);
  };

  return (
    <StoreContext.Provider value={{
      campaign,
      users,
      currentUser,
      setCampaign,
      updateCampaign,
      addChannel,
      updateChannel,
      deleteChannel,
      addChannelPrinciple,
      deleteChannelPrinciple,
      addChannelLink,
      removeChannelLink,
      addChannelNote,
      deleteChannelNote,
      addChannelMember,
      removeChannelMember,
      addProject,
      updateProject,
      deleteProject,
      addProjectUpdate,
      addProjectTicket,
      updateProjectTicket,
      deleteProjectTicket,
      addBet,
      updateBet,
      addTicket,
      updateTicket,
      deleteTicket,
      addRoadmapItem,
      updateRoadmapItem,
      deleteRoadmapItem,
      moveRoadmapItem,
      addTimelineTag,
      deleteTimelineTag,
      importAIPlan,
      switchUser,
      reset
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
