USE [corp]
GO

/****** Object:  Table [dbo].[deviceResolutionStrategies]    Script Date: 4/23/2025 8:53:43 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[deviceResolutionStrategies](
	[resolutionId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[formula] [nvarchar](250) NULL,
	[projectId] [nvarchar](40) NULL,
	[ordinal] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_deviceResolutionStrategies] PRIMARY KEY CLUSTERED 
(
	[resolutionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[deviceResolutionStrategies] ADD  CONSTRAINT [DF_deviceResolutionStrategies_resolutionId]  DEFAULT (newid()) FOR [resolutionId]
GO

ALTER TABLE [dbo].[deviceResolutionStrategies] ADD  DEFAULT ((0)) FOR [ordinal]
GO

ALTER TABLE [dbo].[deviceResolutionStrategies] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[deviceResolutionStrategies] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[deviceResolutionStrategies] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[deviceResolutionStrategies] ADD  DEFAULT ('system') FOR [updateby]
GO

