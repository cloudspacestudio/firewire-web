USE [corp]
GO

/****** Object:  Table [dbo].[categorySubTasks]    Script Date: 4/15/2025 6:43:37 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[categorySubTasks](
	[categorySubTaskId] [nvarchar](40) NOT NULL,
	[categoryId] [nvarchar](40) NOT NULL,
	[statusName] [nvarchar](100) NOT NULL,
	[taskNameFormat] [nvarchar](50) NULL,
	[laborHours] [decimal](18, 0) NOT NULL,
	[ordinal] [smallint] NOT NULL,
	[projectId] [nvarchar](40) NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_categorysubtasks] PRIMARY KEY CLUSTERED 
(
	[categorySubTaskId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  CONSTRAINT [DF_categorySubTasks_categorySubTaskId]  DEFAULT (newid()) FOR [categorySubTaskId]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  DEFAULT ((0.00)) FOR [laborHours]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  DEFAULT ((0)) FOR [ordinal]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[categorySubTasks] ADD  DEFAULT ('system') FOR [updateby]
GO

